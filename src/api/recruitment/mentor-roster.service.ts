import { classKindSql } from '~/common/catalog/item-kind';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assetUrl } from '~/common/storage/asset-url';
import {
  RosterClassDto,
  RosterMentorDetailDto,
  RosterMentorDto,
  RosterSummaryDto,
} from './dto/mentor-roster.dto';
import { findOwnMerchant } from './recruitment-merchant';
import { ACTIVE_MENTOR_ID_SQL } from './recruitment-sql';

// The merchant's mentors ($1 = merchant id): active entries of the mentor
// list plus every active tutor of the merchant's classes. $2 narrows it to
// one user, or is null for all.
const ROSTER_SQL = `
  WITH tutors AS (
    SELECT mentor.user_id, link.class_id, link.created_at
    FROM class_mentors link
    INNER JOIN classes class
      ON class.id = link.class_id AND class.merchant_id = $1 AND class.deleted_at IS NULL
    INNER JOIN mentors mentor
      ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL AND mentor.status = 'active'
    WHERE link.deleted_at IS NULL
  ), listed AS (
    SELECT mentor_user_id AS user_id, joined_at FROM merchant_mentors
    WHERE merchant_id = $1 AND status = 'active' AND deleted_at IS NULL
  ), roster AS (
    SELECT user_id FROM listed UNION SELECT user_id FROM tutors
  )
  SELECT member.id AS user_id, ${ACTIVE_MENTOR_ID_SQL} AS mentor_id,
         member.name, member.email,
         avatar.object_key AS avatar_object_key,
         COALESCE(NULLIF(mentor_profile.expertise, ''), accepted.title) AS specialty,
         (SELECT count(DISTINCT tutor.class_id) FROM tutors tutor
            WHERE tutor.user_id = member.id)::integer AS classes_count,
         (SELECT round(avg(review.rating)::numeric, 1) FROM reviews review
            WHERE review.deleted_at IS NULL
              AND review.class_id IN (SELECT tutor.class_id FROM tutors tutor
                                      WHERE tutor.user_id = member.id)) AS rating,
         COALESCE(
           (SELECT listed.joined_at FROM listed WHERE listed.user_id = member.id),
           (SELECT min(tutor.created_at) FROM tutors tutor WHERE tutor.user_id = member.id)
         ) AS joined_at
  FROM roster
  INNER JOIN users member ON member.id = roster.user_id AND member.deleted_at IS NULL
  LEFT JOIN user_profiles profile ON profile.user_id = member.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
  LEFT JOIN mentors mentor ON mentor.user_id = member.id AND mentor.deleted_at IS NULL
  LEFT JOIN mentor_profiles mentor_profile
    ON mentor_profile.mentor_id = mentor.id AND mentor_profile.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT job.title FROM job_applications application
    INNER JOIN job_postings job ON job.id = application.job_posting_id AND job.merchant_id = $1
    WHERE application.applicant_user_id = member.id AND application.status = 'accepted'
      AND application.deleted_at IS NULL
    ORDER BY application.decided_at DESC NULLS LAST, application.id
    LIMIT 1
  ) accepted ON true
  WHERE $2::uuid IS NULL OR member.id = $2
  ORDER BY joined_at DESC NULLS LAST, member.name, member.id`;

interface RosterRow {
  user_id: string;
  mentor_id: string | null;
  name: string;
  email: string;
  avatar_object_key: string | null;
  specialty: string | null;
  classes_count: number;
  rating: string | null;
  joined_at: Date | null;
}

@Injectable()
export class MentorRosterService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findRoster(userId: string) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const [rows, [counts]] = await Promise.all([
      this.dataSource.query(ROSTER_SQL, [merchant.id, null]) as Promise<
        RosterRow[]
      >,
      this.dataSource.query(
        `SELECT
           (SELECT count(*) FROM job_postings job
              WHERE job.merchant_id = $1 AND job.deleted_at IS NULL
                AND job.status = 'active')::integer AS active_jobs,
           count(*) FILTER (WHERE application.status = 'review')::integer AS pending_applications,
           count(application.id)::integer AS total_applications
         FROM job_applications application
         INNER JOIN job_postings job
           ON job.id = application.job_posting_id AND job.merchant_id = $1 AND job.deleted_at IS NULL
         INNER JOIN users applicant
           ON applicant.id = application.applicant_user_id AND applicant.deleted_at IS NULL
         WHERE application.deleted_at IS NULL`,
        [merchant.id],
      ),
    ]);
    const mentors = rows.map(toRosterMentor);
    const ratings = mentors
      .map((mentor) => mentor.rating)
      .filter((rating): rating is number => rating !== null);
    const summary: RosterSummaryDto = {
      active_jobs: counts.active_jobs,
      pending_applications: counts.pending_applications,
      total_applications: counts.total_applications,
      mentors_count: mentors.length,
      average_rating:
        ratings.length === 0
          ? null
          : Math.round(
              (ratings.reduce((sum, rating) => sum + rating, 0) /
                ratings.length) *
                10,
            ) / 10,
    };
    return {
      data: { summary, mentors },
      responseMessage: 'Get mentor roster success',
    };
  }

  async findRosterMentor(userId: string, mentorUserId: string) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const [row]: RosterRow[] = await this.dataSource.query(ROSTER_SQL, [
      merchant.id,
      mentorUserId,
    ]);
    if (!row) throw new NotFoundException('Mentor not found');

    const classes: RosterClassDto[] = await this.dataSource.query(
      `SELECT class.id, class.title, ${classKindSql('class.type')} AS type,
              (SELECT count(DISTINCT enrollment.user_id) FROM enrollments enrollment
                 WHERE enrollment.class_id = class.id AND enrollment.deleted_at IS NULL)::integer AS students_count,
              (SELECT round(avg(review.rating)::numeric, 1)::float FROM reviews review
                 WHERE review.class_id = class.id AND review.deleted_at IS NULL) AS rating,
              (SELECT count(*) FROM reviews review
                 WHERE review.class_id = class.id AND review.deleted_at IS NULL)::integer AS review_count
       FROM classes class
       WHERE class.merchant_id = $1 AND class.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM class_mentors link
           INNER JOIN mentors mentor
             ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL AND mentor.status = 'active'
           WHERE link.class_id = class.id AND link.deleted_at IS NULL AND mentor.user_id = $2)
       ORDER BY class.created_at DESC, class.id`,
      [merchant.id, mentorUserId],
    );
    const data: RosterMentorDetailDto = { ...toRosterMentor(row), classes };
    return { data, responseMessage: 'Get roster mentor success' };
  }
}

function toRosterMentor(row: RosterRow): RosterMentorDto {
  return {
    user_id: row.user_id,
    mentor_id: row.mentor_id,
    name: row.name,
    email: row.email,
    avatar_url: assetUrl(row.avatar_object_key),
    specialty: row.specialty,
    classes_count: row.classes_count,
    rating: row.rating === null ? null : Number(row.rating),
    joined_at: row.joined_at,
  };
}
