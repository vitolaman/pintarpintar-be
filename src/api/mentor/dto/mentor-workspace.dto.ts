import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const mentorClassTypes = ['bootcamp', 'kelas'] as const;
export type MentorClassType = (typeof mentorClassTypes)[number];

export class MentorClassesQueryDto {
  @ApiPropertyOptional({ enum: mentorClassTypes })
  @IsOptional()
  @IsIn(mentorClassTypes)
  type?: MentorClassType;

  @ApiPropertyOptional({ description: 'Matches the class title or merchant name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export class MentorDashboardStatsDto {
  @ApiProperty({ description: 'Published classes assigned to the mentor' })
  active_classes: number;

  @ApiProperty({ description: 'Of those, created this month (WIB)' })
  active_classes_this_month: number;

  @ApiProperty({ description: 'Distinct enrolled students' })
  total_students: number;

  @ApiProperty({ description: 'Distinct students enrolled in the last 7 days' })
  students_this_week: number;

  @ApiProperty({ description: 'Meetings from today through the next 7 days (WIB)' })
  upcoming_sessions: number;

  @ApiProperty({ example: 4.7 })
  rating: number;

  @ApiProperty()
  review_count: number;
}

export class MentorUpcomingSessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ example: '2026-10-02' })
  date: string;

  @ApiPropertyOptional({ example: '19:00' })
  time: string | null;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  class_title: string;

  @ApiProperty({ enum: mentorClassTypes })
  class_type: MentorClassType;

  @ApiProperty()
  student_count: number;
}

export class MentorRecentMessageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ format: 'uuid' })
  user_id: string;

  @ApiProperty()
  user_name: string;

  @ApiPropertyOptional()
  avatar_url: string | null;

  @ApiProperty({ format: 'uuid' })
  thread_id: string;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  class_title: string;
}

export class MentorClassProgressDto {
  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: mentorClassTypes })
  type: MentorClassType;

  @ApiProperty()
  enrolled_count: number;

  @ApiProperty({ description: 'Average completion percentage', example: 62.5 })
  average_progress: number;
}

export class MentorDashboardResponseDto {
  @ApiProperty({ type: MentorDashboardStatsDto })
  stats: MentorDashboardStatsDto;

  @ApiProperty({ type: [MentorUpcomingSessionDto] })
  upcoming_sessions: MentorUpcomingSessionDto[];

  @ApiProperty({ type: [MentorRecentMessageDto] })
  recent_messages: MentorRecentMessageDto[];

  @ApiProperty({ type: [MentorClassProgressDto] })
  class_progress: MentorClassProgressDto[];
}

export class MentorClassMerchantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class MentorClassResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: mentorClassTypes })
  type: MentorClassType;

  @ApiProperty({ example: 'published' })
  status: string;

  @ApiProperty({ example: 'Lead Tutor / Instruktur Utama' })
  role: string;

  @ApiPropertyOptional({ description: 'Null until classes have a cover image' })
  image: string | null;

  @ApiProperty({ type: MentorClassMerchantDto })
  merchant: MentorClassMerchantDto;

  @ApiProperty()
  students_count: number;

  @ApiProperty()
  thread_count: number;
}

export class TeachingClassMerchantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  avatar_url: string | null;

  @ApiPropertyOptional()
  city: string | null;
}

export class TeachingClassResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: TeachingClassMerchantDto })
  merchant: TeachingClassMerchantDto;

  @ApiProperty({ example: 2024 })
  start_year: number;

  @ApiPropertyOptional({ description: 'Null while the assignment is ongoing', example: null })
  end_year: number | null;

  @ApiProperty({ enum: ['active', 'inactive'], description: 'Aktif / Tidak Aktif' })
  status: 'active' | 'inactive';
}
