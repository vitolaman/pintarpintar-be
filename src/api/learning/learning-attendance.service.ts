import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClassAttendanceService } from '../../class/class-attendance.service';
import {
  BOOTCAMP_MEETING_SQL,
  MEETING_MENTOR_JOIN_SQL,
  MEETING_MENTOR_SQL,
  MEETING_STARTED_SQL,
  MEETING_STATUS_SQL,
  MeetingMentor,
} from '../../class/meeting-sql';
import { classKindOf } from '../../common/catalog/item-kind';
import { assetUrl } from '../../common/storage/asset-url';
import {
  PublicAttendanceMeetingDto,
  AttendanceSessionDto,
  CheckInByEmailDto,
  CheckInByEmailResponseDto,
} from './dto/public-attendance.dto';

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  time: string;
  is_open: boolean;
  status: string;
  duration_minutes: number | null;
  mentor: MeetingMentor | null;
}

/**
 * The public attendance page (`/absensi/{classId}`): anyone with the link
 * sees the session, and an enrolled learner checks in by email without
 * logging in. Attendance goes to the class's latest started meeting through
 * the regular check-in, so certificates and recaps stay consistent.
 */
@Injectable()
export class LearningAttendanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAttendance: ClassAttendanceService,
  ) {}

  async findSession(classId: string) {
    const [session] = await this.dataSource.query(
      `SELECT class.id, class.title, class.type, cover.object_key AS cover_object_key,
              merchant.store_name AS merchant_name,
              COALESCE((
                SELECT array_agg(tutor.name ORDER BY link.created_at, link.id)
                FROM class_mentors link
                INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
                INNER JOIN users tutor ON tutor.id = mentor.user_id AND tutor.deleted_at IS NULL
                WHERE link.class_id = class.id AND link.deleted_at IS NULL
              ), '{}') AS mentor_names
       FROM classes class
       LEFT JOIN merchants merchant ON merchant.id = class.merchant_id
       LEFT JOIN file_assets cover ON cover.id = class.cover_asset_id AND cover.deleted_at IS NULL
       WHERE class.id = $1 AND class.deleted_at IS NULL AND class.status <> 'draft'`,
      [classId],
    );
    if (!session) throw new NotFoundException('Class not found');

    const data: AttendanceSessionDto = {
      class_id: session.id,
      class_title: session.title,
      type: classKindOf(session.type),
      cover_url: assetUrl(session.cover_object_key),
      merchant_name: session.merchant_name,
      mentor_names: session.mentor_names,
      meeting: await this.findSessionMeeting(classId),
    };
    return { data, responseMessage: 'Get attendance session success' };
  }

  async checkInByEmail(classId: string, input: CheckInByEmailDto) {
    const [target] = await this.dataSource.query(
      `SELECT class.title AS class_title, learner.id AS user_id
       FROM classes class
       LEFT JOIN users learner
         ON lower(learner.email) = lower($2) AND learner.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM enrollments enrollment
           WHERE enrollment.class_id = class.id AND enrollment.user_id = learner.id
             AND enrollment.deleted_at IS NULL)
       WHERE class.id = $1 AND class.deleted_at IS NULL AND class.status <> 'draft'`,
      [classId, input.email],
    );
    if (!target) throw new NotFoundException('Class not found');
    if (!target.user_id) {
      throw new NotFoundException('This email is not enrolled in this class');
    }

    const meeting = await this.findSessionMeeting(classId);
    if (!meeting?.is_open) {
      throw new BadRequestException('No meeting of this class has started yet');
    }
    await this.classAttendance.checkIn(
      target.user_id,
      meeting.id,
      input.feedback,
    );

    const [attendance] = await this.dataSource.query(
      `SELECT to_char("checkInTime", 'HH24:MI') AS check_in_time
       FROM attendances
       WHERE meeting_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [meeting.id, target.user_id],
    );
    const data: CheckInByEmailResponseDto = {
      class_id: classId,
      class_title: target.class_title,
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      check_in_time: attendance.check_in_time,
      name: input.name,
    };
    return { data, responseMessage: 'Check in success' };
  }

  // The latest meeting that has started; otherwise the next upcoming one.
  private async findSessionMeeting(
    classId: string,
  ): Promise<PublicAttendanceMeetingDto | null> {
    const [meeting]: MeetingRow[] = await this.dataSource.query(
      `SELECT meeting.id, meeting.title, meeting."date"::text AS date,
              to_char(meeting."time", 'HH24:MI') AS time,
              ${MEETING_STARTED_SQL} AS is_open, ${MEETING_STATUS_SQL} AS status,
              meeting.duration_minutes, ${MEETING_MENTOR_SQL} AS mentor
       FROM meetings meeting
       ${BOOTCAMP_MEETING_SQL}
       ${MEETING_MENTOR_JOIN_SQL}
       WHERE meeting.class_id = $1 AND meeting.deleted_at IS NULL
         AND meeting."date" IS NOT NULL AND meeting."time" IS NOT NULL
       ORDER BY ${MEETING_STARTED_SQL} DESC,
                CASE WHEN ${MEETING_STARTED_SQL} THEN meeting."date" + meeting."time" END DESC,
                meeting."date" + meeting."time" ASC,
                meeting.id
       LIMIT 1`,
      [classId],
    );
    return meeting ?? null;
  }
}
