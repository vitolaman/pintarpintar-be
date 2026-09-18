import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoucherProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  product_type: string;

  @ApiProperty()
  is_published: boolean;
}

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
  minimum_order_amount: number | null;

  @ApiPropertyOptional()
  maximum_discount_amount: number | null;

  @ApiPropertyOptional()
  max_uses: number | null;

  @ApiProperty()
  usage_count: number;

  @ApiPropertyOptional()
  starts_at: Date | null;

  @ApiPropertyOptional()
  expires_at: Date | null;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({
    enum: ['inactive', 'scheduled', 'expired', 'quota_reached', 'active'],
  })
  status: string;

  @ApiProperty({ type: [VoucherProductResponseDto] })
  products: VoucherProductResponseDto[];

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
  minimum_order_amount: number | null;

  @ApiPropertyOptional()
  expires_at: Date | null;

  @ApiProperty({ type: [String] })
  categories: string[];

  @ApiProperty({ type: [String] })
  category_slugs: string[];

  @ApiProperty({ format: 'uuid' })
  merchant_id: string;

  @ApiProperty()
  merchant_name: string;

  @ApiPropertyOptional()
  merchant_slug: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  merchant_avatar_asset_id: string | null;

  @ApiPropertyOptional()
  merchant_tagline: string | null;

  @ApiPropertyOptional()
  merchant_category_label: string | null;
}
