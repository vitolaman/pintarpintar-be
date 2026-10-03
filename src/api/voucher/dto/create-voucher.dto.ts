import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, Matches } from 'class-validator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import {
  ClearableText,
  EnumInput,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';

export const voucherDiscountTypes = ['percentage', 'nominal'] as const;

// A usage limit of 0 is the form's "unlimited", stored as no limit.
const zeroMeansUnlimited = ({ value }: { value: unknown }) =>
  value === 0 || value === '0' ? null : value;

export class CreateVoucherDto {
  @RequiredText({ max: 160, example: 'Voucher Pengguna Baru' })
  name: string;

  @RequiredText({ max: 64, example: 'NEWSTUDENT15' })
  @Matches(/^[A-Za-z0-9_-]+$/)
  code: string;

  @EnumInput(voucherDiscountTypes, { example: 'percentage' })
  discount_type: (typeof voucherDiscountTypes)[number];

  @NumberInput({ min: 0.01, example: 15 })
  discount_value: number;

  @ClearableText({
    max: 2_000,
    example: 'Potongan harga untuk pembeli pertama.',
  })
  description?: string | null;

  @ClearableText({ max: 2_000, example: 'Berlaku untuk produk yang dipilih.' })
  terms?: string | null;

  @NumberInput({ presence: 'nullable', min: 0, example: 50000 })
  minimum_purchase?: number | null;

  @NumberInput({ presence: 'nullable', min: 0, example: 30000 })
  maximum_discount_amount?: number | null;

  @Transform(zeroMeansUnlimited)
  @NumberInput({
    presence: 'nullable',
    integer: true,
    min: 0,
    example: 200,
    description: 'Use 0 for unlimited.',
  })
  usage_limit?: number | null;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  ends_at?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalNotNull()
  @IsBoolean()
  is_active?: boolean;
}
