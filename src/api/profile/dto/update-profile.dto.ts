import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import {
  ClearableText,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';

export class UpdateProfileDto {
  @RequiredText({ max: 120, optional: true, example: 'Budi Santoso' })
  name?: string;

  @ClearableText({ max: 32, example: '+62 812-3456-7890' })
  phone?: string | null;

  @ClearableText({ max: 160, example: 'Belajar skill teknik praktis' })
  headline?: string | null;

  @ClearableText({
    max: 2_000,
    example: 'Sedang memperdalam desain dan otomasi.',
  })
  bio?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'user_avatar',
      'null removes the avatar.',
    ),
  })
  @IsOptional()
  @IsUUID()
  avatar_asset_id?: string | null;
}
