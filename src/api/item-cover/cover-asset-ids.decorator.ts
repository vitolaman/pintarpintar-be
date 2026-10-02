import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { MAX_COVERS } from './item-covers';

/** The ordered cover list of an item: up to 5 distinct uploads, first = main. */
export const CoverAssetIds = (purpose: string) =>
  applyDecorators(
    ApiPropertyOptional({
      type: [String],
      format: 'uuid',
      maxItems: MAX_COVERS,
      description: `Ordered cover uploads (${purpose} rules), up to ${MAX_COVERS}; replaces all covers and the first is the main cover. Do not send together with cover_asset_id.`,
    }),
    OptionalNotNull(),
    IsArray(),
    ArrayMaxSize(MAX_COVERS),
    ArrayUnique(),
    IsUUID('all', { each: true }),
  );
