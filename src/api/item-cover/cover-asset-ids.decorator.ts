import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import {
  AssetPurpose,
  allowedTypesText,
  sizeLimitText,
} from '../file-asset/asset-purpose-rules';
import { MAX_COVERS } from './item-covers';

/** The ordered cover list of an item: up to 5 distinct uploads, first = main. */
export const CoverAssetIds = (purpose: AssetPurpose) =>
  applyDecorators(
    ApiPropertyOptional({
      type: [String],
      format: 'uuid',
      maxItems: MAX_COVERS,
      description: `Ordered asset_ids from POST /api/v1/upload/complete (${allowedTypesText(purpose)}, up to ${sizeLimitText(purpose)} each), at most ${MAX_COVERS}; replaces all covers and the first is the main cover. Do not send together with cover_asset_id.`,
    }),
    OptionalNotNull(),
    IsArray(),
    ArrayMaxSize(MAX_COVERS),
    ArrayUnique(),
    IsUUID('all', { each: true }),
  );
