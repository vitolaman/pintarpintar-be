import { ApiProperty } from '@nestjs/swagger';
import { saleStatuses, saleTypes } from './merchant-dashboard-query.dto';

export class PeriodMetricDto {
  @ApiProperty({ example: 1000000 })
  current: number;

  @ApiProperty({ example: 800000 })
  previous: number;

  @ApiProperty({
    example: 25,
    nullable: true,
    description: 'Percent change; null when previous is 0',
  })
  change_percent: number | null;
}

export class LatestReviewDto {
  @ApiProperty()
  reviewer_name: string;

  @ApiProperty({ nullable: true })
  reviewer_avatar_object_key: string | null;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ nullable: true })
  comment: string | null;

  @ApiProperty()
  item_title: string;

  @ApiProperty()
  created_at: Date;
}

export class ChartPointDto {
  @ApiProperty({ example: '2026-09-01', description: 'Asia/Jakarta date' })
  date: string;

  @ApiProperty({ example: 3 })
  transactions: number;

  @ApiProperty({ example: 897000 })
  revenue: number;
}

export class ActivityDto {
  @ApiProperty({ enum: ['enrollment', 'review', 'purchase'] })
  type: string;

  @ApiProperty({ example: 'John Doe' })
  actor_name: string;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  item_title: string;

  @ApiProperty({ nullable: true, example: 5 })
  rating: number | null;

  @ApiProperty()
  occurred_at: Date;
}

export class UnpaidTransactionDto {
  @ApiProperty()
  order_id: string;

  @ApiProperty()
  item_title: string;

  @ApiProperty({ example: 299000 })
  price: number;

  @ApiProperty()
  checkout_at: Date;

  @ApiProperty()
  buyer_name: string;

  @ApiProperty()
  buyer_email: string;

  @ApiProperty({ nullable: true })
  buyer_phone: string | null;

  @ApiProperty({
    nullable: true,
    description: "The order's Duitku payment page while it can still be paid",
  })
  payment_link: string | null;
}

export class MerchantDashboardResponseDto {
  @ApiProperty({ enum: [7, 30, 90, 365] })
  period_days: number;

  @ApiProperty({
    example: 2968000,
    description: 'Sisa Saldo (earning balance)',
  })
  balance: number;

  @ApiProperty({ enum: ['basic', 'silver', 'gold'] })
  storage_level: string;

  @ApiProperty({
    example: 5268000,
    description: 'Level card transaction total',
  })
  lifetime_earnings: number;

  @ApiProperty({ type: PeriodMetricDto })
  revenue: PeriodMetricDto;

  @ApiProperty({ type: PeriodMetricDto })
  transactions: PeriodMetricDto;

  @ApiProperty({ type: PeriodMetricDto })
  students: PeriodMetricDto;

  @ApiProperty({ example: 8 })
  catalog_total: number;

  @ApiProperty({ example: 2 })
  catalog_new_in_period: number;

  @ApiProperty({ example: 4.8, nullable: true })
  rating_average: number | null;

  @ApiProperty({ example: 145 })
  review_count: number;

  @ApiProperty({ type: LatestReviewDto, nullable: true })
  latest_review: LatestReviewDto | null;

  @ApiProperty({ type: [ChartPointDto] })
  chart: ChartPointDto[];

  @ApiProperty({ type: [ActivityDto] })
  activities: ActivityDto[];

  @ApiProperty({ type: [UnpaidTransactionDto] })
  unpaid_transactions: UnpaidTransactionDto[];
}

export class SaleResponseDto {
  @ApiProperty({ description: 'Order item id' })
  id: string;

  @ApiProperty()
  order_id: string;

  @ApiProperty()
  ordered_at: Date;

  @ApiProperty()
  buyer_name: string;

  @ApiProperty({ nullable: true })
  buyer_phone: string | null;

  @ApiProperty({ enum: saleTypes })
  type: string;

  @ApiProperty()
  item_id: string;

  @ApiProperty()
  item_title: string;

  @ApiProperty({ example: 299000, description: 'Selling price before codes' })
  amount: number;

  @ApiProperty({
    nullable: true,
    example: 'BC',
    description: 'Duitku payment channel code, once paid',
  })
  payment_method: string | null;

  @ApiProperty({ nullable: true })
  coupon_code: string | null;

  @ApiProperty({ nullable: true, description: 'Fees are not implemented yet' })
  platform_fee: number | null;

  @ApiProperty({ nullable: true })
  transaction_fee: number | null;

  @ApiProperty({
    example: 269100,
    description: "The merchant's income: the amount minus its code discounts",
  })
  net_amount: number;

  @ApiProperty({ enum: saleStatuses })
  status: string;
}

export class SalesExportResponseDto {
  @ApiProperty({ type: [SaleResponseDto] })
  rows: SaleResponseDto[];

  @ApiProperty({ description: 'True when more than 5000 rows matched' })
  truncated: boolean;
}

export class CustomerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ description: 'First paid purchase from this merchant' })
  joined_at: Date;

  @ApiProperty({ example: 524000 })
  total_spent: number;

  @ApiProperty({ example: 1 })
  classes_enrolled: number;

  @ApiProperty({ example: 70, minimum: 0, maximum: 100 })
  completion_rate: number;
}
