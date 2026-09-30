import { ApiProperty } from '@nestjs/swagger';
import { MerchantStorageLevel } from '../entities/merchant.entity';

export class MerchantWalletResponseDto {
  @ApiProperty()
  merchant_id: string;

  @ApiProperty({ enum: MerchantStorageLevel, example: 'basic' })
  storage_level: MerchantStorageLevel;

  @ApiProperty({
    example: 13700000,
    description: 'Current balance including income still clearing (Sisa Saldo)',
  })
  earning_balance: number;

  @ApiProperty({
    example: 12500000,
    description: 'Withdrawable balance (Saldo Tersedia)',
  })
  settled_balance: number;

  @ApiProperty({
    example: 1200000,
    description: 'Earning balance not yet settled (Saldo dalam Kliring)',
  })
  clearing_balance: number;

  @ApiProperty({ example: 58700000, description: 'Cumulative income' })
  lifetime_earnings: number;

  @ApiProperty({
    example: 45000000,
    description: 'Sum of successful withdrawals (Total Berhasil Ditarik)',
  })
  total_withdrawn: number;
}
