import { ApiProperty } from '@nestjs/swagger';
import { portalItemTypes, PortalItemType } from './portal-item-query.dto';

export const meetingPlatforms = [
  'Zoom',
  'Google Meet',
  'Microsoft Teams',
] as const;

export type MeetingPlatform = (typeof meetingPlatforms)[number];

export class PortalNextMeetingResponseDto {
  @ApiProperty({ example: 'Sesi 3: Layout dan Plotting' })
  title: string;

  @ApiProperty({ example: '2026-10-02', description: 'Meeting date (WIB)' })
  date: string;

  @ApiProperty({
    example: '19:00',
    nullable: true,
    description: 'Meeting start time (WIB)',
  })
  time: string | null;

  @ApiProperty({ example: 'https://zoom.us/j/123456789', nullable: true })
  live_url: string | null;

  @ApiProperty({ enum: meetingPlatforms, nullable: true, example: 'Zoom' })
  platform: MeetingPlatform | null;
}

export class PortalItemResponseDto {
  @ApiProperty({ description: 'Class id or digital product id' })
  id: string;

  @ApiProperty({ enum: portalItemTypes })
  type: PortalItemType;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cover URL; null without a cover',
  })
  image_url: string | null;

  @ApiProperty({ description: 'When the learner obtained the item' })
  acquired_at: Date;

  @ApiProperty()
  merchant_id: string;

  @ApiProperty({ example: 'Akademi Teknik Nusantara' })
  merchant_name: string;

  @ApiProperty({ nullable: true, example: 'akademi-teknik-nusantara' })
  merchant_slug: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Merchant avatar URL; null without an avatar',
  })
  merchant_avatar_url: string | null;

  @ApiProperty({
    nullable: true,
    minimum: 0,
    maximum: 100,
    description: 'Video classes only',
  })
  progress: number | null;

  @ApiProperty({ nullable: true, description: 'Video classes only' })
  module_count: number | null;

  @ApiProperty({ nullable: true, description: 'Video classes only' })
  assignment_count: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Classes only; true when the learner has a certificate',
  })
  has_certificate: boolean | null;

  @ApiProperty({
    type: PortalNextMeetingResponseDto,
    nullable: true,
    description: 'Live bootcamps only',
  })
  next_meeting: PortalNextMeetingResponseDto | null;
}
