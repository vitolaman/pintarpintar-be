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

  @ApiProperty({
    description:
      'False for an account created through Google that has not set a password; it can add one through password reset.',
  })
  has_password: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  mentor_id: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  merchant_id: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
