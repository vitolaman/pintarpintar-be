import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  is_mentor: boolean;

  @ApiProperty()
  is_merchant: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  mentor_id: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  merchant_id: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
