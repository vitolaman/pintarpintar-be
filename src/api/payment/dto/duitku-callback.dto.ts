import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Duitku's form-encoded payment notification; values arrive as strings and
// the signature covers `amount` exactly as posted.
export class DuitkuCallbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  merchantCode: string;

  @ApiProperty({ example: '150000' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ example: 'ORD-20260930-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  merchantOrderId: string;

  @ApiProperty({ example: '00', description: '`00` success, otherwise failed' })
  @IsString()
  @IsNotEmpty()
  resultCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'BC', description: 'Payment channel code' })
  @IsOptional()
  @IsString()
  paymentCode?: string;

  @ApiPropertyOptional({ example: '2026-10-02' })
  @IsOptional()
  @IsString()
  settlementDate?: string;
}
