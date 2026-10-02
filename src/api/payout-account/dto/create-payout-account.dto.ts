import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';

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
}
