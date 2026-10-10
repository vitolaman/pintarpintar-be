import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ProSubscribeRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The Pro plan ID to subscribe to',
  })
  @IsUUID()
  @IsNotEmpty()
  plan_id: string;

  @ApiPropertyOptional({
    description:
      'Optional discount code; accepted but not applied yet (the discount is 0)',
  })
  @IsOptional()
  @IsString()
  code?: string;
}

export class ProSubscriptionCheckoutResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Unique transaction identifier',
  })
  transaction_id: string;

  @ApiProperty({
    description: 'Reference number for this Pro subscription',
    example: 'PRO-20261009-0001',
  })
  transaction_number: string;

  @ApiProperty({
    example: 49000,
    description: 'Price in rupiah',
  })
  amount: number;

  @ApiProperty({
    example: 0,
    description: 'Discount amount in rupiah',
  })
  discount_amount: number;

  @ApiProperty({
    example: 49000,
    description: 'Total amount to pay in rupiah',
  })
  total_amount: number;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'paid', 'failed', 'cancelled'],
    description: 'Current status of the subscription',
  })
  status: string;

  @ApiProperty({
    nullable: true,
    description: 'Duitku invoice reference; use with checkout.process()',
  })
  payment_reference: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Duitku payment page URL',
  })
  payment_url: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When this subscription was initiated',
  })
  created_at: Date;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'When this subscription expires (pending orders)',
  })
  expires_at: Date | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'When payment was received',
  })
  paid_at: Date | null;
}

export class ProSubscriptionPreviewDto {
  @ApiProperty({
    format: 'uuid',
  })
  plan_id: string;

  @ApiProperty({
    example: 'Pro Bulanan',
  })
  plan_name: string;

  @ApiProperty({
    example: 1,
  })
  duration_months: number;

  @ApiProperty({
    example: 49000,
  })
  base_price: number;

  @ApiProperty({
    example: 0,
  })
  discount_amount: number;

  @ApiProperty({
    example: 49000,
  })
  total_amount: number;
}
