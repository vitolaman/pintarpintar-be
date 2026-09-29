import { ApiProperty } from '@nestjs/swagger';

export class MerchantWalletResponseDto {
  @ApiProperty()
  merchant_id: string;

  @ApiProperty({ example: 0 })
  balance: number;
}
