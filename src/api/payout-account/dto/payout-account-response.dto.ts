import { ApiProperty } from '@nestjs/swagger';
import { payoutBankNames } from './create-payout-account.dto';

export class PayoutAccountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: payoutBankNames })
  bank_name: string;

  @ApiProperty({ example: 'Ahmad Santoso' })
  account_holder_name: string;

  @ApiProperty({ example: '•••• 2841' })
  masked_account_number: string;

  @ApiProperty()
  is_primary: boolean;

  @ApiProperty({ example: 'unverified' })
  verification_status: string;

  @ApiProperty()
  created_at: Date;
}
