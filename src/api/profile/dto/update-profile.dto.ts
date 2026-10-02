import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { trimText } from '~/common/dto/text-transforms';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @OptionalNotNull()
  @IsString()
  @Length(1, 120)
  @Transform(trimText)
  name?: string;

  @ApiPropertyOptional({ example: '+62 812-3456-7890' })
  @OptionalNotNull()
  @IsString()
  @Length(1, 32)
  @Transform(trimText)
  phone?: string;

  @ApiPropertyOptional({ example: 'Belajar skill teknik praktis' })
  @OptionalNotNull()
  @IsString()
  @Length(1, 160)
  @Transform(trimText)
  headline?: string;

  @ApiPropertyOptional({ example: 'Sedang memperdalam desain dan otomasi.' })
  @OptionalNotNull()
  @IsString()
  @Length(1, 2_000)
  @Transform(trimText)
  bio?: string;

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
