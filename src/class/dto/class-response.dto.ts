import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus, ClassType } from '../entities/class.entity';
import { ResourceType } from '../entities/file-resource.entity';

export class ClassResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() merchant_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string;
  @ApiProperty({ enum: ClassStatus }) status: ClassStatus;
  @ApiProperty({ enum: ClassType }) type: ClassType;
  @ApiPropertyOptional() originalPrice: number;
  @ApiPropertyOptional() discountedPrice: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class FileResourceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() chapter_id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ResourceType }) type: ResourceType;
  @ApiPropertyOptional() url: string;
  @ApiPropertyOptional() size: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class VideoResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() chapter_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string;
  @ApiPropertyOptional() youtubeUrl: string;
  @ApiPropertyOptional() duration: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class ChapterResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string;
  @ApiProperty() order: number;
  @ApiProperty({ type: [VideoResponseDto] }) videos: VideoResponseDto[];
  @ApiProperty({ type: [FileResourceResponseDto] }) files: FileResourceResponseDto[];
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class MeetingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() content: string;
  @ApiProperty() date: string;
  @ApiProperty() time: string;
  @ApiPropertyOptional() liveUrl: string;
  @ApiProperty() status: string;
  @ApiProperty() created_at: Date;
}

export class AssignmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string;
  @ApiProperty() due: Date;
  @ApiProperty() type: string;
  @ApiProperty() created_at: Date;
}

export class MentorResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() mentor_id: string;
  @ApiProperty() role: string;
  @ApiPropertyOptional() permissions: any;
  @ApiProperty() created_at: Date;
}

export class StudentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() user_id: string;
  @ApiProperty() class_id: string;
  @ApiPropertyOptional() joinDate: string;
  @ApiPropertyOptional() progress: string;
  @ApiProperty() created_at: Date;
}
