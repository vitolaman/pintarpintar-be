import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MEETING_DURATION_DESCRIPTION,
  MEETING_STATUS_DESCRIPTION,
  MeetingMentorDto,
} from '../../../class/dto/class-response.dto';

export class CheckInByEmailDto {
  @ApiProperty({ example: 'Ahmad Rizki Pratama' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'ahmad.rizki@student.id' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ description: 'Session feedback (Ulasan & Masukan)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}

export class AttendanceMeetingDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, example: '2026-10-01' })
  date: string | null;

  @ApiProperty({
    nullable: true,
    example: '19:00',
    description: 'Asia/Jakarta',
  })
  time: string | null;

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

  @ApiProperty({ enum: ['video', 'live-bootcamp'] })
  class_type: string;

  @ApiProperty({ nullable: true })
  cover_url: string | null;

  @ApiProperty({ nullable: true })
  merchant_name: string | null;

  @ApiProperty({ type: [String] })
  mentor_names: string[];

  @ApiProperty({
    type: AttendanceMeetingDto,
    nullable: true,
    description:
      'The latest started meeting, else the next upcoming one; null without meetings',
  })
  meeting: AttendanceMeetingDto | null;
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
