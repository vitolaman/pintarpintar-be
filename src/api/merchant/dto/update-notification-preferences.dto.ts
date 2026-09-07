import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  email_new_sale?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  email_new_applicant?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  email_new_review?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  email_weekly_report?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsapp_new_order?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsapp_payout_approved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsapp_student_chat?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  promotion_broadcast?: boolean;
}
