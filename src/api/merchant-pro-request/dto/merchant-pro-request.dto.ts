import { ApiProperty } from '@nestjs/swagger';
import { ClearableText } from '~/common/decorator/input.decorator';

export class CreateMerchantProRequestDto {
  @ClearableText({
    max: 2000,
    description: 'Optional message for manual follow-up',
    example: 'I would like to join as a Pro merchant.',
  })
  message?: string | null;
}

export class MerchantProRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  user_id: string | null;

  @ApiProperty({ nullable: true, type: String })
  user_name: string | null;

  @ApiProperty({ nullable: true, type: String })
  user_email: string | null;

  @ApiProperty({ nullable: true, type: String })
  message: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
