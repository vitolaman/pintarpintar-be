import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, ValidateIf } from 'class-validator';
import { TUTOR_ROLES, TutorRole } from '../class-permissions';

export class UpdateClassMentorDto {
  @ApiPropertyOptional({
    enum: TUTOR_ROLES,
    description:
      'Changing the role without permissions applies the new role preset',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(TUTOR_ROLES)
  role?: TutorRole;

  @ApiPropertyOptional({
    description:
      'Complete matrix: areas materi, meeting, tugas, nilai, sertifikat × actions lihat, tambah, edit, delete; missing entries are false',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;
}
