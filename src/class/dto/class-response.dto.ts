import { CLASS_ACTIONS, CLASS_AREAS } from '../class-permissions';
import { ItemCoverDto } from '../../api/item-cover/dto/item-cover.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  classCategories,
  learningLevels,
} from '../../common/catalog/class-details';
import { ClassStatus } from '../entities/class.entity';
import { ClassKind, classKinds } from '../../common/catalog/item-kind';
import { ResourceType } from '../entities/file-resource.entity';

export class ClassResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() merchant_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: ClassStatus }) status: ClassStatus;
  @ApiProperty({ enum: classKinds }) type: ClassKind;
  @ApiPropertyOptional({ nullable: true }) original_price: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Selling price when greater than 0',
  })
  discount_price: number | null;
  @ApiPropertyOptional({ nullable: true }) cover_asset_id: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Null without a cover or when no public asset base URL is configured',
  })
  cover_url: string | null;
  @ApiProperty({
    type: [ItemCoverDto],
    description: 'Ordered covers; the first equals cover_asset_id / cover_url',
  })
  covers: ItemCoverDto[];
  @ApiPropertyOptional({ nullable: true })
  post_purchase_instructions: string | null;
  @ApiPropertyOptional({ nullable: true, enum: classCategories })
  category: string | null;
  @ApiProperty({
    nullable: true,
    example: 'Teknik Sipil',
    description: 'Kategori Skill; null for classes created before the field',
  })
  skill_category: string | null;
  @ApiPropertyOptional({ nullable: true, enum: learningLevels })
  level: string | null;
  @ApiPropertyOptional({ nullable: true }) duration: string | null;
  @ApiPropertyOptional({ nullable: true }) prerequisites: string | null;
  @ApiProperty({ type: [String] }) learning_outcomes: string[];
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class FileResourceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() chapter_id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ResourceType }) type: ResourceType;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Link resources and older rows only',
  })
  url: string | null;
  @ApiPropertyOptional({ nullable: true }) asset_id: string | null;
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description: 'Bytes; null when unknown',
  })
  size: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed download link for uploaded files, valid 10 minutes',
  })
  download_url: string | null;
  @ApiProperty() order: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class VideoResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() chapter_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: ['link', 'file'] }) source: string;
  @ApiPropertyOptional({ nullable: true }) youtube_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    format: 'uuid',
    description: 'Upload of a file video',
  })
  asset_id: string | null;
  @ApiPropertyOptional({ nullable: true }) duration: string | null;
  @ApiProperty() order: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class ChapterResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() order: number;
  @ApiProperty({ type: [VideoResponseDto] }) videos: VideoResponseDto[];
  @ApiProperty({ type: [FileResourceResponseDto] })
  files: FileResourceResponseDto[];
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class MeetingMentorDto {
  @ApiProperty({ description: 'Mentor id' }) id: string;
  @ApiProperty() name: string;
}

export const MEETING_STATUS_DESCRIPTION =
  'Completed once the start plus the duration (180 minutes when unset) has passed';

export const MEETING_DURATION_DESCRIPTION = 'Minutes, 1–1440; null when unset';

export class MeetingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) content: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-10-15' })
  date: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: '19:30',
    description: 'HH:mm, Asia/Jakarta',
  })
  time: string | null;
  @ApiPropertyOptional({ nullable: true }) live_url: string | null;
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
  @ApiProperty() created_at: Date;
}

export class AssignmentResourceResponseDto {
  @ApiProperty() asset_id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'Bytes' }) size: number;
  @ApiProperty({ description: 'Signed download link, valid 10 minutes' })
  download_url: string;
}

export class AssignmentQuestionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() question_text: string;
  @ApiProperty() type: string;
  @ApiPropertyOptional({ type: [String], nullable: true }) options:
    | string[]
    | null;
  @ApiProperty() score_weight: number;
  @ApiPropertyOptional({
    description: 'Only for the owner and tutors with tugas or nilai permission',
  })
  correct_answer?: string | null;
}

export class AssignmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() due: Date;
  @ApiProperty() type: string;
  @ApiPropertyOptional({ type: AssignmentResourceResponseDto, nullable: true })
  resource: AssignmentResourceResponseDto | null;
  @ApiProperty({ description: 'Distinct learners who submitted' })
  submission_count: number;
  @ApiProperty({ type: [AssignmentQuestionResponseDto] })
  questions: AssignmentQuestionResponseDto[];
  @ApiProperty() created_at: Date;
}

export class ClassTutorResponseDto {
  @ApiProperty({ description: 'Tutor assignment id (class_mentors.id)' })
  id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() mentor_id: string;
  @ApiProperty() user_id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
  @ApiProperty({ enum: ['lead', 'assistant', 'moderator'] }) role: string;
  @ApiProperty({
    type: 'object',
    description: 'Areas × actions (lihat, tambah, edit, delete) booleans',
    properties: Object.fromEntries(
      CLASS_AREAS.map((area) => [
        area,
        {
          type: 'object',
          properties: Object.fromEntries(
            CLASS_ACTIONS.map((action) => [action, { type: 'boolean' }]),
          ),
          required: [...CLASS_ACTIONS],
        },
      ]),
    ),
  })
  permissions: Record<string, Record<string, boolean>>;
  @ApiProperty() created_at: Date;
}

export class StudentUserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class StudentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() user_id: string;
  @ApiProperty() class_id: string;
  @ApiPropertyOptional() join_date: string;
  @ApiPropertyOptional() progress: string;
  @ApiProperty() created_at: Date;
  @ApiProperty({ type: StudentUserResponseDto }) user: StudentUserResponseDto;
}
