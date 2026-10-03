import { ClassKind, classKinds } from '~/common/catalog/item-kind';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RosterMentorDto {
  @ApiProperty({ format: 'uuid' }) user_id: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'mentors.id while the user has an active mentor account, otherwise null',
  })
  mentor_id: string | null;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Mentor profile expertise, otherwise the title of the vacancy they were accepted for',
  })
  specialty: string | null;
  @ApiProperty({ description: "The merchant's classes they tutor" })
  classes_count: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 4.8,
    description: 'Average review rating of those classes; null without reviews',
  })
  rating: number | null;
  @ApiPropertyOptional({ nullable: true }) joined_at: Date | null;
}

export class RosterSummaryDto {
  @ApiProperty() active_jobs: number;
  @ApiProperty({ description: 'Applications in review' })
  pending_applications: number;
  @ApiProperty() total_applications: number;
  @ApiProperty() mentors_count: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 4.9,
    description: "Average of the mentors' ratings; null when none has one",
  })
  average_rating: number | null;
}

export class MentorRosterResponseDto {
  @ApiProperty({ type: RosterSummaryDto }) summary: RosterSummaryDto;
  @ApiProperty({ type: [RosterMentorDto] }) mentors: RosterMentorDto[];
}

export class RosterClassDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: classKinds }) type: ClassKind;
  @ApiProperty() students_count: number;
  @ApiPropertyOptional({ nullable: true }) rating: number | null;
  @ApiProperty() review_count: number;
}

export class RosterMentorDetailDto extends RosterMentorDto {
  @ApiProperty({
    type: [RosterClassDto],
    description:
      'Reviews per class come from GET /api/v1/reviews/classes/:classId',
  })
  classes: RosterClassDto[];
}
