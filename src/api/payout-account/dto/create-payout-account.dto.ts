import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Matches } from 'class-validator';
import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';

export const payoutBankNames = [
  'Bank BCA',
  'Bank Mandiri',
  'Bank BNI',
  'Bank BRI',
  'Bank Syariah Indonesia (BSI)',
] as const;

export type PayoutBankName = (typeof payoutBankNames)[number];

export class CreatePayoutAccountDto {
  @EnumInput(payoutBankNames, { example: 'Bank BCA' })
  bank_name: PayoutBankName;

  @RequiredText({ max: 120, example: 'Ahmad Santoso' })
  account_holder_name: string;

  @ApiProperty({ example: '8830192841', description: '6-20 digits' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{6,20}$/, { message: 'account_number must be 6-20 digits' })
  account_number: string;

  @ApiPropertyOptional({
    description:
      'true makes this the primary account and clears the others. The first account is always primary, and the primary changes only when another account is made primary, so false is rejected for the first account and for the current primary.',
  })
  @OptionalNotNull()
  @IsBoolean()
  is_primary?: boolean;
}
