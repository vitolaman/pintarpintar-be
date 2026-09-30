import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsObject, IsOptional } from 'class-validator';
import { TUTOR_ROLES, TutorRole } from '../class-permissions';

export class InviteMentorDto {
  @ApiProperty({ example: 'mentor@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ enum: TUTOR_ROLES, example: 'lead' })
  @IsIn(TUTOR_ROLES)
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
