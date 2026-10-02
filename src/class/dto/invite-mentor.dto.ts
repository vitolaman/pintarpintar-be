import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional } from 'class-validator';
import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';
import { TUTOR_ROLES, TutorRole } from '../class-permissions';

export class InviteMentorDto {
  @RequiredText({ max: 255, example: 'mentor@example.com' })
  @IsEmail()
  email: string;

  @EnumInput(TUTOR_ROLES, { example: 'lead' })
  role: TutorRole;

  @ApiPropertyOptional({
    description:
      'Areas materi, meeting, tugas, nilai, sertifikat × actions lihat, tambah, edit, delete (booleans). Defaults to the role preset.',
    example: {
      meeting: { lihat: true, tambah: true, edit: true, delete: false },
    },
  })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;
}
