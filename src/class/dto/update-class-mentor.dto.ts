import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, ValidateIf } from 'class-validator';
import { EnumInput } from '~/common/decorator/input.decorator';
import { TUTOR_ROLES, TutorRole } from '../class-permissions';

export class UpdateClassMentorDto {
  @EnumInput(TUTOR_ROLES, {
    presence: 'optional',
    description:
      'Changing the role without permissions applies the new role preset',
  })
  role?: TutorRole;

  @ApiPropertyOptional({
    description:
      'Complete matrix: areas materi, meeting, tugas, nilai, sertifikat × actions lihat, tambah, edit, delete; missing entries are false',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;
}
