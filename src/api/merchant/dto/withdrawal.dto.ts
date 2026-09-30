import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MerchantWalletResponseDto } from './merchant-wallet-response.dto';

// Rules shown on the merchant balance page.
export const MINIMUM_WITHDRAWAL = 100_000;
export const WITHDRAWAL_FEE = 5_000;

export class RequestWithdrawalDto {
  @ApiProperty({
    example: 500000,
    minimum: MINIMUM_WITHDRAWAL,
    description: 'Whole rupiah taken from the settled (withdrawable) balance',
  })
  @IsInt()
  @Min(MINIMUM_WITHDRAWAL)
  @Max(10_000_000_000)
  amount: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Defaults to the merchant's primary payout account",
  })
  @IsOptional()
  @IsUUID()
  payout_account_id?: string;
}

export class WithdrawalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['pending', 'success', 'failed'], example: 'pending' })
  status: string;

  @ApiProperty({ example: 500000 })
  amount: number;

  @ApiProperty({ example: WITHDRAWAL_FEE })
  fee_amount: number;

  @ApiProperty({ example: 495000, description: 'Amount minus the fee' })
  transfer_amount: number;

  @ApiProperty({ example: 'BCA •••• 2841 a.n. Budi Santoso' })
  destination: string;

  @ApiProperty()
  requested_at: Date;

  @ApiProperty({ type: MerchantWalletResponseDto })
  wallet: MerchantWalletResponseDto;
}
