import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BOOTCAMP_MEETING_SQL } from '../../class/meeting-sql';
import { assetUrl } from '../../common/storage/asset-url';
import {
  MentorClassesQueryDto,
  MentorClassResponseDto,
  MentorDashboardResponseDto,
  TeachingClassResponseDto,
} from './dto/mentor-workspace.dto';

// Timestamps are stored as UTC without a zone; dashboard periods follow WIB.
const WIB_NOW = `(now() AT TIME ZONE 'Asia/Jakarta')`;
const TO_WIB = (column: string) =>
  `((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')`;

// Classes the active mentor is currently assigned to.
const ASSIGNED_CLASSES = `
  SELECT class.id, class.title, class.type, class.status, class.created_at,
         class.merchant_id, class.cover_asset_id, link.role
  FROM mentors mentor
  INNER JOIN class_mentors link
    ON link.mentor_id = mentor.id AND link.deleted_at IS NULL
  INNER JOIN classes class
    ON class.id = link.class_id AND class.deleted_at IS NULL
  WHERE mentor.id = $1
`;

// Enrollment progress is free text; its leading number is the percentage.
const PROGRESS_PERCENT = `LEAST(100, COALESCE(NULLIF(substring(enrollment.progress FROM '^\\s*([0-9]+(?:\\.[0-9]+)?)'), '')::numeric, 0))`;

@Injectable()
export class MentorWorkspaceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findDashboard(userId: string) {
    const mentorId = await this.findActiveMentorId(userId);
    const [stats] = await this.dataSource.query(
      `WITH mine AS (${ASSIGNED_CLASSES})
       SELECT
         (SELECT count(*) FROM mine WHERE status = 'published')::integer AS active_classes,
         (SELECT count(*) FROM mine WHERE status = 'published'
            AND ${TO_WIB('created_at')} >= date_trunc('month', ${WIB_NOW}))::integer AS active_classes_this_month,
         (SELECT count(DISTINCT enrollment.user_id) FROM enrollments enrollment
            INNER JOIN mine ON mine.id = enrollment.class_id
            WHERE enrollment.deleted_at IS NULL)::integer AS total_students,
         (SELECT count(DISTINCT enrollment.user_id) FROM enrollments enrollment
            INNER JOIN mine ON mine.id = enrollment.class_id
            WHERE enrollment.deleted_at IS NULL
              AND enrollment.created_at >= now() - interval '7 days')::integer AS students_this_week,
         (SELECT count(*) FROM meetings meeting
            INNER JOIN mine ON mine.id = meeting.class_id
            ${BOOTCAMP_MEETING_SQL}
            WHERE meeting.deleted_at IS NULL
              AND meeting."date" BETWEEN ${WIB_NOW}::date AND ${WIB_NOW}::date + 7)::integer AS upcoming_sessions,
         (SELECT COALESCE(round(avg(review.rating)::numeric, 1), 0) FROM reviews review
            INNER JOIN mine ON mine.id = review.class_id
            WHERE review.deleted_at IS NULL) AS rating,
         (SELECT count(*) FROM reviews review
            INNER JOIN mine ON mine.id = review.class_id
            WHERE review.deleted_at IS NULL)::integer AS review_count`,
      [mentorId],
    );

    const [sessions, messages, progress] = await Promise.all([
      this.dataSource.query(
        `WITH mine AS (${ASSIGNED_CLASSES})
         SELECT meeting.id, meeting.title, meeting."date"::text AS date,
                to_char(meeting."time", 'HH24:MI') AS time,
                mine.id AS class_id, mine.title AS class_title, mine.type AS class_type,
                (SELECT count(*) FROM enrollments enrollment
                   WHERE enrollment.class_id = mine.id
                     AND enrollment.deleted_at IS NULL)::integer AS student_count
         FROM meetings meeting
         INNER JOIN mine ON mine.id = meeting.class_id
         ${BOOTCAMP_MEETING_SQL}
         WHERE meeting.deleted_at IS NULL AND meeting."date" >= ${WIB_NOW}::date
         ORDER BY meeting."date", meeting."time" NULLS LAST, meeting.id
         LIMIT 5`,
        [mentorId],
      ),
      this.dataSource.query(
        `WITH mine AS (${ASSIGNED_CLASSES})
         SELECT comment.id, comment.content, comment.created_at,
                author.id AS user_id, author.name AS user_name,
                avatar.object_key AS avatar_object_key,
                thread.id AS thread_id, mine.id AS class_id, mine.title AS class_title
         FROM comments comment
         INNER JOIN discussion_threads thread
           ON thread.id = comment.thread_id AND thread.deleted_at IS NULL
         INNER JOIN mine ON mine.id = thread.class_id
         INNER JOIN users author ON author.id = comment.author_id
         LEFT JOIN user_profiles profile
           ON profile.user_id = author.id AND profile.deleted_at IS NULL
         LEFT JOIN file_assets avatar
           ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
         WHERE comment.deleted_at IS NULL AND comment.author_role = 'student'
         ORDER BY comment.created_at DESC, comment.id DESC
         LIMIT 5`,
        [mentorId],
      ),
      this.dataSource.query(
        `WITH mine AS (${ASSIGNED_CLASSES})
         SELECT mine.id AS class_id, mine.title, mine.type,
                count(enrollment.id)::integer AS enrolled_count,
                COALESCE(round(avg(${PROGRESS_PERCENT}), 1), 0) AS average_progress
         FROM mine
         LEFT JOIN enrollments enrollment
           ON enrollment.class_id = mine.id AND enrollment.deleted_at IS NULL
         GROUP BY mine.id, mine.title, mine.type, mine.created_at
         ORDER BY mine.created_at DESC, mine.id`,
        [mentorId],
      ),
    ]);

    const data: MentorDashboardResponseDto = {
      stats: {
        active_classes: stats.active_classes,
        active_classes_this_month: stats.active_classes_this_month,
        total_students: stats.total_students,
        students_this_week: stats.students_this_week,
        upcoming_sessions: stats.upcoming_sessions,
        rating: Number(stats.rating),
        review_count: stats.review_count,
      },
      upcoming_sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        date: session.date,
        time: session.time,
        class_id: session.class_id,
        class_title: session.class_title,
        class_type: toCatalogType(session.class_type),
        student_count: session.student_count,
      })),
      recent_messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        created_at: message.created_at,
        user_id: message.user_id,
        user_name: message.user_name,
        avatar_url: assetUrl(message.avatar_object_key),
        thread_id: message.thread_id,
        class_id: message.class_id,
        class_title: message.class_title,
      })),
      class_progress: progress.map((row) => ({
        class_id: row.class_id,
        title: row.title,
        type: toCatalogType(row.type),
        enrolled_count: row.enrolled_count,
        average_progress: Number(row.average_progress),
      })),
    };
    return { data, responseMessage: 'Get mentor dashboard success' };
  }

  async findClasses(userId: string, query: MentorClassesQueryDto) {
    const mentorId = await this.findActiveMentorId(userId);
    const classType =
      query.type === 'bootcamp'
        ? 'live-bootcamp'
        : query.type === 'kelas'
          ? 'video'
          : null;
    const search = query.search?.trim()
      ? query.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
      : null;

    const rows = await this.dataSource.query(
      `WITH mine AS (${ASSIGNED_CLASSES})
       SELECT mine.id, mine.title, mine.type, mine.status, mine.role,
              merchant.id AS merchant_id, merchant.store_name AS merchant_name,
              cover.object_key AS cover_object_key,
              (SELECT count(*) FROM enrollments enrollment
                 WHERE enrollment.class_id = mine.id
                   AND enrollment.deleted_at IS NULL)::integer AS students_count,
              (SELECT count(*) FROM discussion_threads thread
                 WHERE thread.class_id = mine.id
                   AND thread.deleted_at IS NULL)::integer AS thread_count
       FROM mine
       INNER JOIN merchants merchant ON merchant.id = mine.merchant_id
       LEFT JOIN file_assets cover
         ON cover.id = mine.cover_asset_id AND cover.deleted_at IS NULL
       WHERE ($2::text IS NULL OR mine.type = $2)
         AND ($3::text IS NULL OR mine.title ILIKE '%' || $3 || '%' ESCAPE '\\'
              OR merchant.store_name ILIKE '%' || $3 || '%' ESCAPE '\\')
       ORDER BY mine.created_at DESC, mine.id`,
      [mentorId, classType, search],
    );

    const data: MentorClassResponseDto[] = rows.map((row) => {
      const coverUrl = assetUrl(row.cover_object_key);
      return {
        id: row.id,
        title: row.title,
        type: toCatalogType(row.type),
        status: row.status,
        role: row.role,
        image: coverUrl,
        cover_url: coverUrl,
        merchant: { id: row.merchant_id, name: row.merchant_name },
        students_count: row.students_count,
        thread_count: row.thread_count,
      };
    });
    return { data, responseMessage: 'Get mentor classes success' };
  }

  // Includes removed assignments so the profile shows the full teaching history.
  async findTeachingClasses(userId: string) {
    const mentorId = await this.findActiveMentorId(userId);
    const rows = await this.dataSource.query(
      `SELECT DISTINCT ON (class.id)
              class.id, class.title, class.status, class.deleted_at AS class_deleted_at,
              link.created_at AS started_at, link.deleted_at AS ended_at,
              merchant.id AS merchant_id, merchant.store_name AS merchant_name,
              merchant_profile.city AS merchant_city,
              avatar.object_key AS merchant_avatar_object_key,
              cover.object_key AS cover_object_key
       FROM class_mentors link
       INNER JOIN classes class ON class.id = link.class_id
       LEFT JOIN file_assets cover
         ON cover.id = class.cover_asset_id AND cover.deleted_at IS NULL
       INNER JOIN merchants merchant ON merchant.id = class.merchant_id
       LEFT JOIN merchant_profiles merchant_profile
         ON merchant_profile.merchant_id = merchant.id
         AND merchant_profile.deleted_at IS NULL
       LEFT JOIN file_assets avatar
         ON avatar.id = merchant_profile.avatar_asset_id AND avatar.deleted_at IS NULL
       WHERE link.mentor_id = $1
       ORDER BY class.id, link.deleted_at DESC NULLS FIRST, link.created_at DESC`,
      [mentorId],
    );

    const data: TeachingClassResponseDto[] = rows
      .map((row) => {
        const active =
          row.ended_at === null &&
          row.class_deleted_at === null &&
          row.status === 'published';
        return {
          id: row.id,
          title: row.title,
          cover_url: assetUrl(row.cover_object_key),
          merchant: {
            id: row.merchant_id,
            name: row.merchant_name,
            avatar_url: assetUrl(row.merchant_avatar_object_key),
            city: row.merchant_city,
          },
          start_year: new Date(row.started_at).getUTCFullYear(),
          end_year: row.ended_at
            ? new Date(row.ended_at).getUTCFullYear()
            : null,
          status: active ? ('active' as const) : ('inactive' as const),
        };
      })
      .sort(
        (a, b) =>
          Number(b.status === 'active') - Number(a.status === 'active') ||
          b.start_year - a.start_year,
      );
    return { data, responseMessage: 'Get teaching classes success' };
  }

  private async findActiveMentorId(userId: string): Promise<string> {
    const [mentor] = await this.dataSource.query(
      `SELECT id FROM mentors
       WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [userId],
    );
    if (!mentor) throw new NotFoundException('Mentor not found');
    return mentor.id;
  }
}

function toCatalogType(classType: string): 'bootcamp' | 'kelas' {
  return classType === 'live-bootcamp' ? 'bootcamp' : 'kelas';
}
