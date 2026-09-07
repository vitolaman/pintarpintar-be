import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MerchantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  store_name: string;

  @ApiPropertyOptional()
  store_description: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  tagline: string | null;

  @ApiPropertyOptional()
  category_label: string | null;

  @ApiPropertyOptional()
  city: string | null;

  @ApiPropertyOptional()
  public_email: string | null;

  @ApiPropertyOptional()
  public_phone: string | null;

  @ApiPropertyOptional()
  website_url: string | null;

  @ApiPropertyOptional()
  instagram_handle: string | null;

  @ApiPropertyOptional()
  youtube_url: string | null;

  @ApiPropertyOptional()
  linkedin_url: string | null;

  @ApiPropertyOptional()
  expertise: string | null;

  @ApiPropertyOptional()
  experience_years: number | null;

  @ApiPropertyOptional()
  education: string | null;

  @ApiPropertyOptional()
  portfolio_url: string | null;

  @ApiPropertyOptional()
  refund_policy: string | null;

  @ApiPropertyOptional()
  digital_license: string | null;

  @ApiPropertyOptional()
  terms_accepted_at: Date | null;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty()
  email_new_sale: boolean;

  @ApiProperty()
  email_new_applicant: boolean;

  @ApiProperty()
  email_new_review: boolean;

  @ApiProperty()
  email_weekly_report: boolean;

  @ApiProperty()
  whatsapp_new_order: boolean;

  @ApiProperty()
  whatsapp_payout_approved: boolean;

  @ApiProperty()
  whatsapp_student_chat: boolean;

  @ApiProperty()
  promotion_broadcast: boolean;
}
