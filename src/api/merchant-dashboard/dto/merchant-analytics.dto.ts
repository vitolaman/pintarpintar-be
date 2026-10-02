import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { trimText } from '~/common/dto/text-transforms';
import {
  EnumInput,
  NumberInput,
  QueryFilter,
} from '~/common/decorator/input.decorator';

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GRANULARITIES = ['day', 'month', 'year'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const SUMMARY_PERIODS = ['today', 'month', 'year'] as const;
export type SummaryPeriod = (typeof SUMMARY_PERIODS)[number];

export const VISIT_TARGETS = [
  'storefront',
  'class',
  'digital_product',
] as const;
export type VisitTarget = (typeof VISIT_TARGETS)[number];

export class StudentGrowthQueryDto {
  @ApiProperty({
    example: '2026-01-01',
    description: 'YYYY-MM-DD, Asia/Jakarta',
  })
  @Matches(CALENDAR_DATE, { message: 'from must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'from must be a real date' })
  from: string;

  @ApiProperty({ example: '2026-06-30', description: 'YYYY-MM-DD, inclusive' })
  @Matches(CALENDAR_DATE, { message: 'to must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'to must be a real date' })
  to: string;

  @EnumInput(GRANULARITIES, {
    presence: 'filter',
    description:
      'Defaults to the page rule: day within one month, month within one year, otherwise year',
  })
  granularity?: Granularity;
}

export class DailySalesQueryDto {
  @ApiPropertyOptional({
    example: '2026-10',
    description: 'YYYY-MM; defaults to the current Asia/Jakarta month',
  })
  @QueryFilter()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month?: string;
}

export class MonthlyRevenueQueryDto {
  @NumberInput({
    presence: 'optional',
    integer: true,
    min: 2000,
    max: 2100,
    example: 2026,
    description: 'Defaults to the current Asia/Jakarta year',
  })
  year?: number;
}

export class AnalyticsSummaryQueryDto {
  @EnumInput(SUMMARY_PERIODS, {
    presence: 'filter',
    default: 'month',
    description: 'Defaults to month',
  })
  period?: SummaryPeriod;
}

export class TrackVisitDto {
  @EnumInput(VISIT_TARGETS)
  target_type: VisitTarget;

  @ApiProperty({
    description:
      'Merchant id or slug for the storefront; class or digital product id otherwise',
  })
  @Transform(trimText)
  @IsString()
  @Length(1, 120)
  target_id: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Random id the browser keeps; required only without a login token, and ignored with one',
  })
  @QueryFilter()
  @IsOptional()
  @IsUUID()
  visitor_id?: string;
}

export class StudentGrowthPointDto {
  @ApiProperty({ example: '2026-03-01', description: 'Checkpoint start' })
  date: string;

  @ApiProperty({
    description: 'Distinct students enrolled up to the checkpoint end',
  })
  students: number;
}

export class StudentGrowthResponseDto {
  @ApiProperty({ enum: GRANULARITIES }) granularity: Granularity;
  @ApiProperty({ type: [StudentGrowthPointDto] })
  points: StudentGrowthPointDto[];
}

export class DailySalesPointDto {
  @ApiProperty({ example: '2026-10-03' }) date: string;
  @ApiProperty({ description: 'Paid orders with the merchant items' })
  transactions: number;
  @ApiProperty({ description: 'Merchant net revenue' }) revenue: number;
}

export class DailySalesResponseDto {
  @ApiProperty({ example: '2026-10' }) month: string;
  @ApiProperty() total_transactions: number;
  @ApiProperty() total_revenue: number;
  @ApiProperty({ type: [DailySalesPointDto] }) days: DailySalesPointDto[];
}

export class MonthlyRevenuePointDto {
  @ApiProperty({ example: 1, description: '1–12' }) month: number;
  @ApiProperty({ description: 'Merchant net revenue' }) total: number;
}

export class MonthlyRevenueResponseDto {
  @ApiProperty({ example: 2026 }) year: number;
  @ApiProperty() total_revenue: number;
  @ApiProperty({ type: [MonthlyRevenuePointDto] })
  months: MonthlyRevenuePointDto[];
}

export class SummaryMetricDto {
  @ApiPropertyOptional({ nullable: true }) value: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Same elapsed span of the previous period',
  })
  previous: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Percent change; null when previous is null or 0',
  })
  change_percent: number | null;
}

export class SummaryWindowDto {
  @ApiProperty({ description: 'Asia/Jakarta start' }) from: string;
  @ApiProperty({ description: 'Asia/Jakarta end (exclusive)' }) to: string;
  @ApiProperty() transactions: number;
  @ApiProperty() revenue: number;
  @ApiProperty() buyers: number;
  @ApiProperty() returning_buyers: number;
  @ApiProperty() visitors: number;
}

export class AnalyticsSummaryResponseDto {
  @ApiProperty({ enum: SUMMARY_PERIODS }) period: SummaryPeriod;
  @ApiProperty({
    type: SummaryMetricDto,
    description:
      'Buyers per visitor, percent, at most 100; null without visits',
  })
  conversion_rate: SummaryMetricDto;
  @ApiProperty({
    type: SummaryMetricDto,
    description:
      'Buyers with another purchase from the merchant in the previous 90 days, percent',
  })
  retention_rate: SummaryMetricDto;
  @ApiProperty({
    type: SummaryMetricDto,
    description: 'Net revenue per paid order, rupiah',
  })
  average_order_value: SummaryMetricDto;
  @ApiProperty({ type: SummaryWindowDto }) current: SummaryWindowDto;
  @ApiProperty({ type: SummaryWindowDto }) previous: SummaryWindowDto;
}

export class TrackVisitResponseDto {
  @ApiProperty({
    description:
      'False for the merchant own visits and known bots; repeated visits on one day are true but stored once',
  })
  recorded: boolean;
}
