import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CertificateViewDto } from '../../../class/dto/certificate.dto';
import { ClassFaqResponseDto } from '../../../class/dto/class-faq.dto';
import {
  MEETING_DURATION_DESCRIPTION,
  MEETING_STATUS_DESCRIPTION,
  MeetingMentorDto,
} from '../../../class/dto/class-response.dto';
import { AttendanceStatus } from '../../../class/entities/attendance.entity';
import { ClassKind, classKinds } from '../../../common/catalog/item-kind';

export class NextVideoDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() chapter_id: string;
}

export class LearnerProgressResponseDto {
  @ApiProperty() class_id: string;

  @ApiProperty({
    description: 'Completed videos over all videos, whole percent',
  })
  progress: number;

  @ApiPropertyOptional({
    type: NextVideoDto,
    nullable: true,
    description: 'First unfinished video in chapter order; null when done',
  })
  next_video: NextVideoDto | null;
}

export class LearningMerchantDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) slug: string | null;
}

export class LearningMentorDto {
  @ApiProperty({ description: 'Mentor id used by the profile page' })
  id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
}

export class LearningVideoDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true }) duration: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Null for a file video',
  })
  youtube_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Set for YouTube links; null for other embeds',
  })
  youtube_id: string | null;
  @ApiProperty({ enum: ['link', 'file'] }) source: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'File videos only: a signed link that expires',
  })
  video_url: string | null;
  @ApiProperty() order: number;
  @ApiProperty() is_completed: boolean;
  @ApiProperty() created_at: Date;
}

export class LearningResourceDto {
  @ApiProperty() id: string;
  @ApiProperty() chapter_id: string;
  @ApiProperty() name: string;
  @ApiProperty({ example: 'pdf' }) type: string;
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description: 'Bytes; null when unknown',
  })
  size: number | null;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Link resources and older URL-only files',
  })
  url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Uploaded files: signed link valid 10 minutes',
  })
  download_url: string | null;
  @ApiProperty() created_at: Date;
}

export class LearningChapterDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() order: number;
  @ApiProperty({ type: [LearningVideoDto] }) videos: LearningVideoDto[];
  @ApiProperty({ type: [LearningResourceDto] }) files: LearningResourceDto[];
}

export class LearningMeetingDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) content: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-10-15' })
  date: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: '19:30',
    description: 'Asia/Jakarta',
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
  @ApiPropertyOptional({
    enum: Object.values(AttendanceStatus),
    nullable: true,
    description: "The caller's attendance; null while none is recorded",
  })
  my_attendance_status: AttendanceStatus | null;
}

export class LearningClassResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: classKinds }) type: ClassKind;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Instruksi Email: what the learner does after buying',
  })
  post_purchase_instructions: string | null;
  @ApiPropertyOptional({ nullable: true }) cover_url: string | null;
  @ApiProperty({ type: LearningMerchantDto }) merchant: LearningMerchantDto;
  @ApiProperty() students_count: number;
  @ApiProperty({ type: [LearningMentorDto] }) mentors: LearningMentorDto[];
  @ApiProperty({ type: [LearningChapterDto] }) chapters: LearningChapterDto[];
  @ApiProperty({ type: [LearningMeetingDto] }) meetings: LearningMeetingDto[];
  @ApiProperty({
    type: [ClassFaqResponseDto],
    description: 'Class FAQ, in order',
  })
  faqs: ClassFaqResponseDto[];
  @ApiProperty() progress: number;
  @ApiPropertyOptional({ type: NextVideoDto, nullable: true })
  next_video: NextVideoDto | null;

  @ApiPropertyOptional({ type: CertificateViewDto, nullable: true })
  certificate: CertificateViewDto | null;
}
