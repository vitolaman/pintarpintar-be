import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assetUrl } from '~/common/storage/asset-url';
import { ItemCoverDto } from './dto/item-cover.dto';
import { ItemCoverImage } from './entities/item-cover-image.entity';

export const MAX_COVERS = 5;

export type CoverOwner =
  | { classId: string }
  | { productId: string }
  | { bundleId: string };

export type CoverInput = {
  cover_asset_id?: string | null;
  cover_asset_ids?: string[];
};

const OWNER_COLUMNS = {
  class: 'class_id',
  product: 'product_id',
  bundle: 'bundle_id',
} as const;

function ownerColumns(owner: CoverOwner): Partial<ItemCoverImage> {
  if ('classId' in owner) return { classId: owner.classId };
  if ('productId' in owner) return { productId: owner.productId };
  return { bundleId: owner.bundleId };
}

async function currentCoverIds(
  manager: EntityManager,
  owner: CoverOwner,
  currentMain: string | null,
): Promise<string[]> {
  const rows = await manager.find(ItemCoverImage, {
    where: ownerColumns(owner),
    order: { position: 'ASC' },
  });
  if (rows.length > 0) return rows.map((row) => row.assetId);
  return currentMain ? [currentMain] : [];
}

async function writeCovers(
  manager: EntityManager,
  owner: CoverOwner,
  assetIds: string[],
): Promise<string | null> {
  await manager.delete(ItemCoverImage, ownerColumns(owner));
  if (assetIds.length > 0) {
    await manager.insert(
      ItemCoverImage,
      assetIds.map((assetId, position) => ({
        ...ownerColumns(owner),
        assetId,
        position,
      })),
    );
  }
  return assetIds[0] ?? null;
}

/**
 * Applies a request's cover fields to an item and returns its new main cover
 * (store it as the item's cover_asset_id), or undefined when the request
 * carries neither field.
 * - `cover_asset_ids` replaces the ordered list.
 * - `cover_asset_id` (the single-cover contract) sets the main cover and keeps
 *   the others; `null` removes the main cover so the next one becomes main.
 * `assertAsset` applies the item's cover rules to each new asset.
 */
export async function applyCoverInput(
  manager: EntityManager,
  owner: CoverOwner,
  input: CoverInput,
  currentMain: string | null,
  assertAsset: (assetId: string) => Promise<unknown>,
): Promise<string | null | undefined> {
  const hasList = input.cover_asset_ids !== undefined;
  const hasMain = input.cover_asset_id !== undefined;
  if (hasList && hasMain) {
    throw new BadRequestException(
      'Send either cover_asset_ids or cover_asset_id, not both',
    );
  }
  if (hasList) {
    for (const assetId of input.cover_asset_ids) await assertAsset(assetId);
    return writeCovers(manager, owner, input.cover_asset_ids);
  }
  if (!hasMain) return undefined;

  const current = await currentCoverIds(manager, owner, currentMain);
  if (input.cover_asset_id === null) {
    return writeCovers(manager, owner, current.slice(1));
  }
  await assertAsset(input.cover_asset_id);
  const reordered = [
    input.cover_asset_id,
    ...current.filter((assetId) => assetId !== input.cover_asset_id),
  ].slice(0, MAX_COVERS);
  return writeCovers(manager, owner, reordered);
}

/** Copies one class's covers, in order, to another (class duplication). */
export async function copyClassCovers(
  manager: EntityManager,
  sourceClassId: string,
  targetClassId: string,
): Promise<void> {
  const rows = await manager.find(ItemCoverImage, {
    where: { classId: sourceClassId },
    order: { position: 'ASC' },
  });
  if (rows.length === 0) return;
  await manager.insert(
    ItemCoverImage,
    rows.map((row) => ({
      classId: targetClassId,
      assetId: row.assetId,
      position: row.position,
    })),
  );
}

/** Covers of several items of one kind, in order; deleted uploads are left out. */
export async function findCovers(
  manager: Pick<EntityManager, 'query'>,
  kind: keyof typeof OWNER_COLUMNS,
  itemIds: string[],
): Promise<Map<string, ItemCoverDto[]>> {
  const covers = new Map<string, ItemCoverDto[]>(
    itemIds.map((itemId) => [itemId, []]),
  );
  if (itemIds.length === 0) return covers;
  const column = OWNER_COLUMNS[kind];
  const rows: { owner_id: string; asset_id: string; object_key: string }[] =
    await manager.query(
      `SELECT cover.${column} AS owner_id, cover.asset_id, asset.object_key
       FROM item_cover_images cover
       INNER JOIN file_assets asset ON asset.id = cover.asset_id AND asset.deleted_at IS NULL
       WHERE cover.${column} = ANY($1::uuid[]) AND cover.deleted_at IS NULL
       ORDER BY cover.${column}, cover.position`,
      [itemIds],
    );
  for (const row of rows) {
    covers.get(row.owner_id)?.push({
      asset_id: row.asset_id,
      url: assetUrl(row.object_key),
    });
  }
  return covers;
}
