import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export const voucherDiscountTypes = ['percentage', 'nominal'] as const;

const trim = ({ value }: { value?: string }) => value?.trim();
const optionalTrim = ({ value }: { value?: string | null }) =>
  value === null ? null : value?.trim() || undefined;
const optionalNumber = ({ value }: { value?: unknown }) =>
  value === '' || value === undefined
    ? undefined
    : value === null
      ? null
      : Number(value);
const optionalLimit = ({ value }: { value?: unknown }) => {
  const numberValue = optionalNumber({ value });
  return numberValue === 0 ? null : numberValue;
};

export class CreateVoucherDto {
  @ApiProperty({ example: 'Voucher Pengguna Baru' })
  @IsString()
  @Length(1, 160)
  @Transform(trim)
  name: string;

  @ApiProperty({ example: 'NEWSTUDENT15' })
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  @Transform(trim)
  code: string;

  @ApiProperty({ enum: voucherDiscountTypes, example: 'percentage' })
  @IsIn(voucherDiscountTypes)
  discount_type: (typeof voucherDiscountTypes)[number];

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0.01)
  @Transform(optionalNumber)
  discount_value: number;

  @ApiPropertyOptional({ example: 'Potongan harga untuk pembeli pertama.' })
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  @Transform(optionalTrim)
  description?: string;

  @ApiPropertyOptional({ example: 'Berlaku untuk produk yang dipilih.' })
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  @Transform(optionalTrim)
  terms?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(optionalNumber)
  minimum_order_amount?: number | null;

  @ApiPropertyOptional({ example: 30000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(optionalNumber)
  maximum_discount_amount?: number | null;

  @ApiPropertyOptional({ example: 200, description: 'Use 0 for unlimited.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(optionalLimit)
  max_uses?: number | null;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expires_at?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
