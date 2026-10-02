import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { RequiredText } from '~/common/decorator/input.decorator';

export class RegisterMerchantDto {
  @RequiredText({ max: 160, example: 'Akademi Teknik Nusantara' })
  store_name: string;

  @RequiredText({
    max: 2_000,
    example: 'Kelas dan bootcamp teknik untuk profesional.',
  })
  store_description: string;

  @ApiPropertyOptional({ nullable: true, default: false, example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  need_change_password?: boolean | null;
}
