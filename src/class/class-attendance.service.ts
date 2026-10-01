import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assetUrl } from '../common/storage/asset-url';
import { ClassAccessService } from './class-access.service';
import { ClassCertificateService } from './class-certificate.service';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { LearnerAccessService } from './learner-access.service';
import { loadLearnerMetrics } from './learner-metrics';
import {
  BOOTCAMP_MEETING_SQL,
  MEETING_MENTOR_JOIN_SQL,
  MEETING_MENTOR_SQL,
  MEETING_STARTED_SQL,
  MEETING_STATUS_SQL,
  MeetingMentor,
} from './meeting-sql';

interface MeetingRow {
  id: string;
  class_id: string;
  title: string;
  content: string | null;
  date: string | null;
  time: string | null;
  live_url: string | null;
  has_started: boolean;
  status: string;
  duration_minutes: number | null;
  mentor: MeetingMentor | null;
}

const MEETING_SQL = `
  SELECT meeting.id, meeting.class_id, meeting.title, meeting.content,
         meeting."date"::text AS date, to_char(meeting."time", 'HH24:MI') AS time,
         meeting."liveUrl" AS live_url, ${MEETING_STARTED_SQL} AS has_started,
         ${MEETING_STATUS_SQL} AS status, meeting.duration_minutes,
         ${MEETING_MENTOR_SQL} AS mentor
  FROM meetings meeting
  ${BOOTCAMP_MEETING_SQL}
  ${MEETING_MENTOR_JOIN_SQL}
  WHERE meeting.id = $1 AND meeting.deleted_at IS NULL
`;

const ATTENDANCE_FIELDS = `attendance.status,
  to_char(attendance."checkInTime", 'HH24:MI') AS check_in_time,
  attendance.notes, attendance.created_at AS recorded_at`;

// Learners check themselves in once a meeting has started; tutors with the
// `meeting` permission read the recap and correct statuses. A learner with no
// record for a started meeting counts as absent (alpa).
@Injectable()
export class ClassAttendanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
    private readonly learnerAccess: LearnerAccessService,
    private readonly certificates: ClassCertificateService,
  ) {}

  async findMeetingForLearner(userId: string, meetingId: string) {
    const manager = this.dataSource.manager;
    const meeting = await this.findLearnerMeeting(manager, userId, meetingId);
    return {
      data: await this.learnerMeetingView(manager, userId, meeting),
      responseMessage: 'Get meeting success',
    };
  }

  // The account is the identity; any name or email a client sends is ignored.
  // A repeat check-in keeps the first time and replaces the review.
  async checkIn(userId: string, meetingId: string, review?: string | null) {
    return this.dataSource.transaction(async (manager) => {
      const meeting = await this.findLearnerMeeting(manager, userId, meetingId);
      if (!meeting.has_started) {
        throw new BadRequestException('The meeting has not started yet');
      }
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `attendance:${meetingId}:${userId}`,
      ]);
      const existing = await manager.findOne(Attendance, {
        where: { meeting_id: meetingId, user_id: userId },
      });
      if (existing) {
        if (review !== undefined) existing.notes = review;
        existing.status = AttendanceStatus.HADIR;
        existing.checkInTime ??= await jakartaTime(manager);
        existing.updated_by = userId;
        await manager.save(Attendance, existing);
      } else {
        await manager.save(
          Attendance,
          manager.create(Attendance, {
            meeting_id: meetingId,
            user_id: userId,
            status: AttendanceStatus.HADIR,
            checkInTime: await jakartaTime(manager),
            notes: review ?? null,
            created_by: userId,
          }),
        );
      }
      await this.certificates.issueEligible(manager, meeting.class_id, [
        userId,
      ]);
      return {
        data: await this.learnerMeetingView(manager, userId, meeting),
        responseMessage: 'Check in success',
      };
    });
  }

  async findRecap(userId: string, classId: string, meetingId: string) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'lihat');
    const manager = this.dataSource.manager;
    const meeting = await this.findClassMeeting(manager, classId, meetingId);
    const learners = await manager.query(
      `SELECT learner.id AS user_id, learner.name, learner.email,
              avatar.object_key AS avatar_object_key,
              COALESCE(attendance.status, 'alpa') AS status,
              to_char(attendance."checkInTime", 'HH24:MI') AS check_in_time,
              attendance.notes
       FROM enrollments enrollment
       INNER JOIN users learner ON learner.id = enrollment.user_id
       LEFT JOIN user_profiles profile ON profile.user_id = learner.id AND profile.deleted_at IS NULL
       LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
       LEFT JOIN attendances attendance
         ON attendance.meeting_id = $2 AND attendance.user_id = learner.id
         AND attendance.deleted_at IS NULL
       WHERE enrollment.class_id = $1 AND enrollment.deleted_at IS NULL
       ORDER BY learner.name, learner.id`,
      [classId, meetingId],
    );
    const counts = { hadir: 0, izin: 0, alpa: 0 };
    for (const learner of learners) counts[learner.status] += 1;
    return {
      data: {
        meeting: publicMeeting(meeting),
        counts,
        learners: learners.map((learner) => ({
          user_id: learner.user_id,
          name: learner.name,
          email: learner.email,
          avatar_url: assetUrl(learner.avatar_object_key),
          status: learner.status,
          check_in_time: learner.check_in_time,
          notes: learner.notes,
        })),
      },
      responseMessage: 'Get attendance success',
    };
  }

  async setStatus(
    userId: string,
    classId: string,
    meetingId: string,
    learnerId: string,
    status: AttendanceStatus,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'meeting',
        'edit',
        manager,
      );
      await this.findClassMeeting(manager, classId, meetingId);
      const [enrolled] = await manager.query(
        `SELECT 1 FROM enrollments
         WHERE class_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [classId, learnerId],
      );
      if (!enrolled) throw new NotFoundException('Learner not found');
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `attendance:${meetingId}:${learnerId}`,
      ]);
      const existing = await manager.findOne(Attendance, {
        where: { meeting_id: meetingId, user_id: learnerId },
      });
      if (existing) {
        existing.status = status;
        existing.updated_by = userId;
        await manager.save(Attendance, existing);
      } else {
        await manager.save(
          Attendance,
          manager.create(Attendance, {
            meeting_id: meetingId,
            user_id: learnerId,
            status,
            created_by: userId,
          }),
        );
      }
      await this.certificates.issueEligible(manager, classId, [learnerId]);
    });
    return this.findRecap(userId, classId, meetingId);
  }

  async findSummary(userId: string, classId: string) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'lihat');
    const manager = this.dataSource.manager;
    const [[meetings], metrics] = await Promise.all([
      manager.query(
        `SELECT count(*)::integer AS total_meetings,
                count(*) FILTER (WHERE ${MEETING_STARTED_SQL})::integer AS started_meetings
         FROM meetings meeting
         ${BOOTCAMP_MEETING_SQL}
         WHERE meeting.class_id = $1 AND meeting.deleted_at IS NULL`,
        [classId],
      ),
      loadLearnerMetrics(manager, classId),
    ]);
    const attendance = metrics
      .map((metric) => metric.attendance_percent)
      .filter((percent): percent is number => percent !== null);
    return {
      data: {
        total_meetings: meetings.total_meetings,
        started_meetings: meetings.started_meetings,
        total_learners: metrics.length,
        // hadir records over learners × started meetings, as a percentage.
        average_attendance_percent:
          attendance.length === 0
            ? null
            : Math.round(
                (attendance.reduce((sum, percent) => sum + percent, 0) /
                  attendance.length) *
                  10,
              ) / 10,
      },
      responseMessage: 'Get attendance summary success',
    };
  }

  private async findLearnerMeeting(
    manager: EntityManager,
    userId: string,
    meetingId: string,
  ): Promise<MeetingRow> {
    const [meeting] = await manager.query(MEETING_SQL, [meetingId]);
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.learnerAccess.requireEnrollment(
      userId,
      meeting.class_id,
      manager,
    );
    return meeting;
  }

  private async findClassMeeting(
    manager: EntityManager,
    classId: string,
    meetingId: string,
  ): Promise<MeetingRow> {
    const [meeting] = await manager.query(MEETING_SQL, [meetingId]);
    if (!meeting || meeting.class_id !== classId) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }

  private async learnerMeetingView(
    manager: EntityManager,
    userId: string,
    meeting: MeetingRow,
  ) {
    const [[context], mentors, [attendance]] = await Promise.all([
      manager.query(
        `SELECT class.id, class.title, class.type, merchant.store_name AS merchant_name
         FROM classes class
         INNER JOIN merchants merchant ON merchant.id = class.merchant_id
         WHERE class.id = $1`,
        [meeting.class_id],
      ),
      manager.query(
        `SELECT tutor.name FROM class_mentors link
         INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
         INNER JOIN users tutor ON tutor.id = mentor.user_id
         WHERE link.class_id = $1 AND link.deleted_at IS NULL
         ORDER BY link.created_at, link.id`,
        [meeting.class_id],
      ),
      manager.query(
        `SELECT ${ATTENDANCE_FIELDS} FROM attendances attendance
         WHERE attendance.meeting_id = $1 AND attendance.user_id = $2
           AND attendance.deleted_at IS NULL`,
        [meeting.id, userId],
      ),
    ]);
    return {
      meeting: publicMeeting(meeting),
      class: {
        id: context.id,
        title: context.title,
        type: context.type,
        merchant_name: context.merchant_name,
      },
      mentor_names: mentors.map((mentor) => mentor.name),
      my_attendance: attendance ?? null,
    };
  }
}

function publicMeeting(meeting: MeetingRow) {
  return {
    id: meeting.id,
    title: meeting.title,
    content: meeting.content,
    date: meeting.date,
    time: meeting.time,
    live_url: meeting.live_url,
    has_started: meeting.has_started,
    status: meeting.status,
    duration_minutes: meeting.duration_minutes,
    mentor: meeting.mentor,
  };
}

async function jakartaTime(manager: EntityManager): Promise<string> {
  const [{ time }] = await manager.query(
    `SELECT to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS time`,
  );
  return time;
}
