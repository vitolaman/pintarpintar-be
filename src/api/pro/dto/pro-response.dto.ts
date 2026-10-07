import { ApiProperty } from '@nestjs/swagger';

export class ProPlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'pro-monthly' })
  code: string;

  @ApiProperty({ example: 'Pro Bulanan' })
  name: string;

  @ApiProperty({ example: 1 })
  duration_months: number;

  @ApiProperty({ example: 49000, description: 'Price in rupiah' })
  price: number;
}

export class ProPeriodResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Pro Bulanan',
    description:
      'Plan name when the period was taken; null for a manual grant without a plan',
  })
  plan_name: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 1 })
  duration_months: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 49000 })
  price: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  starts_at: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  ends_at: Date;

  @ApiProperty({ enum: ['payment', 'manual'] })
  source: string;

  @ApiProperty({ enum: ['active', 'cancelled'] })
  status: string;
}

export class ProSubscriptionResponseDto {
  @ApiProperty({ description: 'True while an active Pro period covers now' })
  is_pro: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description:
      'End of the Pro time that continues from now without a gap; null when not Pro',
  })
  pro_until: Date | null;

  @ApiProperty({ type: ProPeriodResponseDto, nullable: true })
  current: ProPeriodResponseDto | null;

  @ApiProperty({
    type: [ProPeriodResponseDto],
    description: 'Active periods that have not started yet, earliest first',
  })
  upcoming: ProPeriodResponseDto[];

  @ApiProperty({
    type: [ProPeriodResponseDto],
    description: 'Ended and cancelled periods, newest first',
  })
  history: ProPeriodResponseDto[];
}
