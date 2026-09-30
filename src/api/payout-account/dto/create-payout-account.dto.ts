import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';

export const payoutBankNames = [
  'Bank BCA',
  'Bank Mandiri',
  'Bank BNI',
  'Bank BRI',
  'Bank Syariah Indonesia (BSI)',
] as const;

export type PayoutBankName = (typeof payoutBankNames)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePayoutAccountDto {
  @ApiProperty({ enum: payoutBankNames, example: 'Bank BCA' })
  @IsIn(payoutBankNames)
  bank_name: PayoutBankName;

  @ApiProperty({ example: 'Ahmad Santoso', minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  account_holder_name: string;

  @ApiProperty({ example: '8830192841', description: '6-20 digits' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{6,20}$/, { message: 'account_number must be 6-20 digits' })
  account_number: string;
}
