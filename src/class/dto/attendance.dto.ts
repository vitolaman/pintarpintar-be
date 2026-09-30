import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class CheckInDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    description:
      'Optional review of the session. Name and email come from the account; any sent are ignored.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  review?: string | null;
}

export class SetAttendanceStatusDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
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
}

export class MyAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus }) status: string;
  @ApiPropertyOptional({ nullable: true, description: 'HH:mm Asia/Jakarta' })
  check_in_time: string | null;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty() recorded_at: Date;
}

export class AttendanceClassDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() type: string;
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
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
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
