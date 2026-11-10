import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { QueryFilter } from '~/common/decorator/input.decorator';

export class DailyTransactionQueryDto {
  @ApiPropertyOptional({
    example: '2026-11',
    description: 'YYYY-MM, defaults to the current Asia/Jakarta month',
  })
  @QueryFilter()
  @IsOptional()
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be YYYY-MM',
  })
  month?: string;
}

export class DailyTransactionPointDto {
  @ApiProperty({ example: '2026-11-01' }) date: string;
  @ApiProperty({ example: 3 }) total_transactions: number;
  @ApiProperty({ example: '125000.00', description: 'Exact IDR amount' })
  total_nominal: string;
}

export class DailyTransactionResponseDto {
  @ApiProperty({ example: '2026-11' }) month: string;
  @ApiProperty({ example: 'Asia/Jakarta' }) timezone: string;
  @ApiProperty() total_transactions: number;
  @ApiProperty({ example: '125000.00', description: 'Exact IDR amount' })
  total_nominal: string;
  @ApiProperty({ type: [DailyTransactionPointDto] })
  days: DailyTransactionPointDto[];
}
