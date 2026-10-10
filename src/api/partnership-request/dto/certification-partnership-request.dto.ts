import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import {
  ClearableText,
  RequiredText,
} from '~/common/decorator/input.decorator';

export class CreateCertificationPartnershipRequestDto {
  @RequiredText({
    max: 200,
    example: 'Lembaga Sertifikasi Teknik Nusantara',
    description: 'Nama Lembaga',
  })
  institution_name: string;

  @ClearableText({
    max: 2000,
    description: 'Profil Lembaga (opsional): bidang, akreditasi, program',
  })
  profile?: string | null;

  @RequiredText({ max: 255, example: 'kerjasama@lembaga.id' })
  @IsEmail()
  email: string;

  @RequiredText({ max: 32, example: '0812 3456 7890', description: 'No. Telp' })
  phone: string;
}

export class CertificationPartnershipRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  created_at: Date;
}
