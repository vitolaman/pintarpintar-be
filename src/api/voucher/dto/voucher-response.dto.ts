import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoucherResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  merchant_id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  terms: string | null;

  @ApiProperty({ enum: ['percentage', 'nominal'] })
  discount_type: string;

  @ApiProperty()
  discount_value: number;

  @ApiPropertyOptional()
  minimum_purchase: number | null;

  @ApiPropertyOptional()
  maximum_discount_amount: number | null;

  @ApiPropertyOptional({ description: 'Null when unlimited.' })
  usage_limit: number | null;

  @ApiProperty()
  used_count: number;

  @ApiPropertyOptional()
  starts_at: Date | null;

  @ApiPropertyOptional()
  ends_at: Date | null;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({
    enum: ['inactive', 'scheduled', 'expired', 'limit_reached', 'active'],
  })
  status: string;

  @ApiProperty()
  created_at: Date;
}

export class PublicVoucherResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: ['percentage', 'nominal'] })
  discount_type: string;

  @ApiProperty()
  discount_value: number;

  @ApiPropertyOptional()
  minimum_purchase: number | null;

  @ApiPropertyOptional({
    description: 'Cap on the discount amount; null when uncapped.',
  })
  maximum_discount_amount: number | null;

  @ApiPropertyOptional()
  ends_at: Date | null;

  @ApiProperty({ format: 'uuid' })
  merchant_id: string;

  @ApiProperty()
  merchant_name: string;

  @ApiPropertyOptional()
  merchant_slug: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Merchant avatar URL; null without an avatar',
  })
  merchant_avatar_url: string | null;

  @ApiPropertyOptional()
  merchant_tagline: string | null;

  @ApiPropertyOptional()
  merchant_category_label: string | null;

  @ApiPropertyOptional({
    example: 'pemrograman-it',
    description: 'Slug derived from the merchant category label.',
  })
  merchant_category_slug: string | null;

  @ApiProperty({
    enum: [
      'PROMO SUPER',
      'DISKON TINGGI',
      'PENGGUNA BARU',
      'BUNDLING PROMO',
      'PRODUK DIGITAL',
      'PROMO KREATIF',
    ],
    description: 'Presentation tag, stable per voucher',
  })
  tag: string;

  @ApiProperty({
    description:
      'Whether the caller claimed this voucher; false without a token',
  })
  is_claimed: boolean;
}
