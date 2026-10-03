import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import {
  ClearableText,
  RequiredText,
} from '~/common/decorator/input.decorator';
import {
  MEETING_DURATION_DESCRIPTION,
  MEETING_STATUS_DESCRIPTION,
  MeetingMentorDto,
} from '../../../class/dto/class-response.dto';
import { ClassKind, classKinds } from '../../../common/catalog/item-kind';

export class CheckInByEmailDto {
  @RequiredText({ max: 120, example: 'Ahmad Rizki Pratama' })
  name: string;

  @RequiredText({ max: 255, example: 'ahmad.rizki@student.id' })
  @IsEmail()
  email: string;

  @ClearableText({
    max: 1000,
    description: 'Session feedback (Ulasan & Masukan)',
  })
  feedback?: string | null;
}

export class PublicAttendanceMeetingDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ example: '2026-10-01' })
  date: string;

  @ApiProperty({ example: '19:00', description: 'Asia/Jakarta' })
  time: string;

  @ApiProperty({ description: 'The meeting has started, so check-in is open' })
  is_open: boolean;

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

export class AttendanceSessionDto {
  @ApiProperty()
  class_id: string;

  @ApiProperty()
  class_title: string;

  @ApiProperty({ enum: classKinds })
  type: ClassKind;

  @ApiProperty({ nullable: true })
  cover_url: string | null;

  @ApiProperty({ nullable: true })
  merchant_name: string | null;

  @ApiProperty({ type: [String] })
  mentor_names: string[];

  @ApiProperty({
    type: PublicAttendanceMeetingDto,
    nullable: true,
    description:
      'The latest started meeting, else the next upcoming one; null when no meeting has a date and time (always for video classes)',
  })
  meeting: PublicAttendanceMeetingDto | null;
}

export class CheckInByEmailResponseDto {
  @ApiProperty()
  class_id: string;

  @ApiProperty()
  class_title: string;

  @ApiProperty()
  meeting_id: string;

  @ApiProperty()
  meeting_title: string;

  @ApiProperty({
    example: '19:05',
    description: 'First check-in, Asia/Jakarta',
  })
  check_in_time: string;

  @ApiProperty({ description: 'The name entered on the form' })
  name: string;
}
