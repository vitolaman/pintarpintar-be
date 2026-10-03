import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClearableText, EnumInput } from '~/common/decorator/input.decorator';
import { AttendanceStatus } from '../entities/attendance.entity';
import { ClassKind, classKinds } from '../../common/catalog/item-kind';
import {
  MEETING_DURATION_DESCRIPTION,
  MEETING_STATUS_DESCRIPTION,
  MeetingMentorDto,
} from './class-response.dto';

export class CheckInDto {
  @ClearableText({
    max: 2000,
    description:
      'Optional feedback on the session (Ulasan & Masukan). Name and email come from the account; sending them is rejected with 400.',
  })
  feedback?: string | null;
}

export class SetAttendanceStatusDto {
  @EnumInput(Object.values(AttendanceStatus))
  status: AttendanceStatus;
}

export class AttendanceMeetingDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) content: string | null;
  @ApiPropertyOptional({ nullable: true }) date: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'HH:mm Asia/Jakarta' })
  time: string | null;
  @ApiPropertyOptional({ nullable: true }) live_url: string | null;
  @ApiProperty() has_started: boolean;
  @ApiProperty({
    enum: ['upcoming', 'completed'],
    description: MEETING_STATUS_DESCRIPTION,
  })
  status: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 90,
    description: MEETING_DURATION_DESCRIPTION,
  })
  duration_minutes: number | null;
  @ApiPropertyOptional({ type: MeetingMentorDto, nullable: true })
  mentor: MeetingMentorDto | null;
}

export class MyAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus }) status: string;
  @ApiPropertyOptional({ nullable: true, description: 'HH:mm Asia/Jakarta' })
  check_in_time: string | null;
  @ApiPropertyOptional({ nullable: true }) feedback: string | null;
  @ApiProperty() recorded_at: Date;
}

export class AttendanceClassDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: classKinds }) type: ClassKind;
  @ApiProperty() merchant_name: string;
}

export class LearnerMeetingDto {
  @ApiProperty({ type: AttendanceMeetingDto }) meeting: AttendanceMeetingDto;
  @ApiProperty({ type: AttendanceClassDto }) class: AttendanceClassDto;
  @ApiProperty({ type: [String] }) mentor_names: string[];
  @ApiPropertyOptional({ type: MyAttendanceDto, nullable: true })
  my_attendance: MyAttendanceDto | null;
}

export class AttendanceLearnerDto {
  @ApiProperty() user_id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
  @ApiProperty({
    enum: AttendanceStatus,
    description: 'No record counts as alpa',
  })
  status: string;
  @ApiPropertyOptional({ nullable: true }) check_in_time: string | null;
  @ApiPropertyOptional({ nullable: true }) feedback: string | null;
}

export class AttendanceCountsDto {
  @ApiProperty() hadir: number;
  @ApiProperty() izin: number;
  @ApiProperty() alpa: number;
}

export class AttendanceRecapDto {
  @ApiProperty({ type: AttendanceMeetingDto }) meeting: AttendanceMeetingDto;
  @ApiProperty({ type: AttendanceCountsDto }) counts: AttendanceCountsDto;
  @ApiProperty({ type: [AttendanceLearnerDto] })
  learners: AttendanceLearnerDto[];
}

export class AttendanceSummaryDto {
  @ApiProperty() total_meetings: number;
  @ApiProperty() started_meetings: number;
  @ApiProperty() total_learners: number;
  @ApiPropertyOptional({
    nullable: true,
    description: 'hadir over learners × started meetings, percent',
  })
  average_attendance_percent: number | null;
}
