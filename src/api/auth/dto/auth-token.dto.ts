import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenDto {
  @ApiProperty({ description: 'Bearer token for this device' })
  token: string;
}
