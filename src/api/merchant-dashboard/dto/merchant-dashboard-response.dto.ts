import { MerchantLevelSummaryDto } from '../../merchant-level/dto/merchant-level.dto';
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
    description: 'Percent change, one decimal; null when previous is 0',
  })
  change_percent: number | null;
}

export class LatestReviewDto {
  @ApiProperty()
  reviewer_name: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Reviewer avatar URL; null without an avatar',
  })
  reviewer_avatar_url: string | null;

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

  @ApiProperty({
    example: 3,
    description: "Paid orders with the merchant's items, dated at payment",
  })
  transactions: number;

  @ApiProperty({
    example: 897000,
    description: "Net revenue of the day's paid sales",
  })
  revenue: number;
}

export class ActivityDto {
  @ApiProperty({
    enum: ['enrollment', 'review', 'purchase'],
    description:
      'enrollment in a class, review of a class or digital product, or a paid digital product or bundle item',
  })
  type: string;

  @ApiProperty({ example: 'John Doe' })
  actor_name: string;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  item_title: string;

  @ApiProperty({
    nullable: true,
    example: 5,
    description: 'Reviews only; null otherwise',
  })
  rating: number | null;

  @ApiProperty({
    description: 'Enrollment time, review time, or order time of the purchase',
  })
  occurred_at: Date;
}

export class UnpaidTransactionDto {
  @ApiProperty()
  order_id: string;

  @ApiProperty()
  item_title: string;

  @ApiProperty({
    example: 299000,
    description: "The item's net price (price minus its code-discount share)",
  })
  price: number;

  @ApiProperty({ description: 'Order time' })
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
  @ApiProperty({
    enum: [7, 30, 90, 365],
    description:
      'Today and the period_days − 1 days before it, in Asia/Jakarta days',
  })
  period_days: number;

  @ApiProperty({
    example: 2968000,
    description: 'Sisa Saldo (earning balance)',
  })
  balance: number;

  @ApiProperty({ enum: ['basic', 'silver', 'gold'] })
  storage_level: string;

  @ApiProperty({ type: MerchantLevelSummaryDto })
  level: MerchantLevelSummaryDto;

  @ApiProperty({
    example: 5268000,
    description:
      'Cumulative net income from paid orders (wallet lifetime earnings), shown as the level card transaction total',
  })
  lifetime_earnings: number;

  @ApiProperty({
    type: PeriodMetricDto,
    description:
      "Net revenue (price minus code-discount shares) of the merchant's items in orders paid in the period",
  })
  revenue: PeriodMetricDto;

  @ApiProperty({
    type: PeriodMetricDto,
    description:
      "Orders paid in the period that contain at least one of the merchant's items",
  })
  transactions: PeriodMetricDto;

  @ApiProperty({
    type: PeriodMetricDto,
    description: 'Distinct buyers of those orders',
  })
  students: PeriodMetricDto;

  @ApiProperty({
    example: 8,
    description: 'Non-deleted classes and digital products',
  })
  catalog_total: number;

  @ApiProperty({
    example: 2,
    description:
      'Of catalog_total, those created in the last period_days × 24 hours',
  })
  catalog_new_in_period: number;

  @ApiProperty({
    example: 4.8,
    nullable: true,
    description:
      'All-time average over reviews of its classes and digital products, one decimal; null without reviews',
  })
  rating_average: number | null;

  @ApiProperty({ example: 145 })
  review_count: number;

  @ApiProperty({ type: LatestReviewDto, nullable: true })
  latest_review: LatestReviewDto | null;

  @ApiProperty({
    type: [ChartPointDto],
    description: 'One zero-filled point per day of the period, ending today',
  })
  chart: ChartPointDto[];

  @ApiProperty({ type: [ActivityDto], description: 'Latest 10, newest first' })
  activities: ActivityDto[];

  @ApiProperty({
    type: [UnpaidTransactionDto],
    description:
      'Latest 20 items of pending orders whose payment window has not expired',
  })
  unpaid_transactions: UnpaidTransactionDto[];
}

export class SaleResponseDto {
  @ApiProperty({ description: 'Order item id' })
  id: string;

  @ApiProperty()
  order_id: string;

  @ApiProperty({ description: 'Order time' })
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

  @ApiProperty({
    nullable: true,
    example: 'BCA Virtual Account',
    description:
      'Readable name of the payment channel: "Gratis" for a free order, the code for an unknown channel, null while unpaid',
  })
  payment_method_label: string | null;

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

  @ApiProperty({
    enum: saleStatuses,
    description:
      'Order status; an unpaid order past its payment expiry reads expired',
  })
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

  @ApiProperty({
    description: 'Order time of the first paid purchase from this merchant',
  })
  joined_at: Date;

  @ApiProperty({
    example: 524000,
    description:
      'Net amount of their paid items (price minus code-discount shares)',
  })
  total_spent: number;

  @ApiProperty({
    example: 1,
    description: 'Distinct classes of the merchant they are enrolled in',
  })
  classes_enrolled: number;

  @ApiProperty({
    example: 70,
    minimum: 0,
    maximum: 100,
    description:
      "Average progress of their enrollments in the merchant's classes; 0 without enrollments",
  })
  completion_rate: number;
}
