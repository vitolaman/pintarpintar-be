import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  email_new_sale?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  email_new_applicant?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  email_new_review?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  email_weekly_report?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  whatsapp_new_order?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  whatsapp_payout_approved?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  whatsapp_student_chat?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  promotion_broadcast?: boolean;
}
