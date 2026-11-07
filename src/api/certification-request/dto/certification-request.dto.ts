import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import {
  ClearableText,
  PhoneInput,
  RequiredText,
} from '~/common/decorator/input.decorator';

export class CreateCertificationRequestDto {
  @RequiredText({ max: 200, example: 'Lembaga Sertifikasi Nusantara' })
  organization_name: string;

  @ClearableText({ max: 2000, description: 'Optional organization profile' })
  organization_profile?: string | null;

  @RequiredText({ max: 255, example: 'contact@organization.id' })
  @IsEmail()
  organization_email: string;

  @PhoneInput()
  organization_phone: string;
}

export class CertificationRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  user_id: string | null;

  @ApiProperty({ nullable: true, type: String })
  user_name: string | null;

  @ApiProperty({ nullable: true, type: String })
  user_email: string | null;

  @ApiProperty()
  organization_name: string;

  @ApiProperty({ nullable: true, type: String })
  organization_profile: string | null;

  @ApiProperty()
  organization_email: string;

  @ApiProperty()
  organization_phone: string;

  @ApiProperty({ description: 'Time the request was created' })
  requested_at: Date;

  @ApiProperty()
  updated_at: Date;
}
