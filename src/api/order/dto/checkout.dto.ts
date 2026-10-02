import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CatalogItemRefDto,
  catalogItemTypes,
} from '~/common/catalog/catalog-item';
import { OrderStatus } from '../entities/order.entity';
import {
  CodeRejectionReason,
  codeRejectionReasons,
} from '../checkout/checkout-pricing';

export class CheckoutRequestDto {
  @ApiProperty({
    type: [CatalogItemRefDto],
    description: 'Items to buy, from the cart or a single "Beli Sekarang"',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CatalogItemRefDto)
  items: CatalogItemRefDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['HEMAT50K'],
    description:
      'Up to one merchant voucher and one discount code, case-insensitive',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  codes?: string[];
}

export class CheckoutItemResponseDto {
  @ApiProperty({ enum: catalogItemTypes })
  type: string;

  @ApiProperty({ description: 'Class, digital product, or bundle id' })
  item_id: string;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;

  @ApiProperty({ nullable: true, description: 'Cover object key' })
  image: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Public cover URL (null without a cover)',
  })
  image_url: string | null;

  @ApiProperty()
  merchant_id: string;

  @ApiProperty({ nullable: true })
  merchant_name: string | null;

  @ApiProperty({ example: 299000, description: 'Selling price before codes' })
  price: number;

  @ApiProperty({ example: 29900, description: "This item's code discount" })
  discount_amount: number;
}

export class AppliedCodeResponseDto {
  @ApiProperty({ enum: ['voucher', 'discount'] })
  kind: string;

  @ApiProperty({ example: 'HEMAT50K' })
  code: string;

  @ApiProperty()
  merchant_id: string;

  @ApiProperty({ nullable: true })
  merchant_name: string | null;

  @ApiProperty({ example: 50000 })
  discount_amount: number;
}

export class RejectedCodeResponseDto {
  @ApiProperty({ example: 'HEMAT50K', description: 'The code, upper-cased' })
  code: string;

  @ApiProperty({
    enum: codeRejectionReasons,
    description:
      'not_found: no such code; expired: ended or deactivated; not_started: starts later; used_up: usage limit reached; already_used: this user used the recurring code; minimum_not_met: the merchant items are below its minimum; not_applicable: no selected item is eligible',
  })
  reason: CodeRejectionReason;
}

export class CheckoutPreviewResponseDto {
  @ApiProperty({ type: [CheckoutItemResponseDto] })
  items: CheckoutItemResponseDto[];

  @ApiProperty({
    type: [AppliedCodeResponseDto],
    description: 'The codes applied to the price',
  })
  codes: AppliedCodeResponseDto[];

  @ApiProperty({
    type: [RejectedCodeResponseDto],
    description:
      'Entered codes left out of the price; checkout rejects them with 400',
  })
  rejected_codes: RejectedCodeResponseDto[];

  @ApiProperty({ example: 598000 })
  subtotal: number;

  @ApiProperty({ example: 50000 })
  discount_amount: number;

  @ApiProperty({ example: 548000, description: 'Amount to pay' })
  total_amount: number;
}

export class OrderCodeResponseDto {
  @ApiProperty({ enum: ['voucher', 'discount'] })
  kind: string;

  @ApiProperty({ example: 'HEMAT50K' })
  code: string;
}

export class OrderDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'ORD-20260930-0001' })
  order_number: string;

  @ApiProperty({
    enum: OrderStatus,
    description: 'An unpaid order past its expiry reads as `expired`',
  })
  status: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ nullable: true })
  expires_at: Date | null;

  @ApiProperty({ nullable: true })
  paid_at: Date | null;

  @ApiProperty({
    nullable: true,
    example: 'BC',
    description: 'Duitku payment channel code',
  })
  payment_method: string | null;

  @ApiProperty({ type: [CheckoutItemResponseDto] })
  items: CheckoutItemResponseDto[];

  @ApiProperty({ type: [OrderCodeResponseDto] })
  codes: OrderCodeResponseDto[];

  @ApiProperty({ example: 598000 })
  subtotal: number;

  @ApiProperty({ example: 50000 })
  discount_amount: number;

  @ApiProperty({ example: 548000, description: 'Amount to pay' })
  total_amount: number;

  @ApiProperty({
    nullable: true,
    description:
      'Duitku reference for `checkout.process(reference)`; only while payable',
  })
  payment_reference: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Duitku payment page; only while payable',
  })
  payment_url: string | null;
}
