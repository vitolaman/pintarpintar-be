import { PartialType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { EmailPreferencesResponseDto } from './email-preferences-response.dto';

export class UpdateEmailPreferencesDto extends PartialType(
  EmailPreferencesResponseDto,
  { skipNullProperties: false },
) {
  @OptionalNotNull()
  @IsBoolean()
  email_order_paid?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_learner_announcement?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_application_submitted?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_merchant_registered?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_pro_paid?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_interview_scheduled?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_application_result?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_mentor_announcement?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_new_sale?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_new_applicant?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_merchant_announcement?: boolean;

  @OptionalNotNull()
  @IsBoolean()
  email_cashflow_success?: boolean;
}
