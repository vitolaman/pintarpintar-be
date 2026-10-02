import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MerchantStorageLevel } from '../merchant/entities/merchant.entity';
import { MERCHANT_LEVEL_RULES } from './merchant-level-rules';

const GIBIBYTE = 1024 * 1024 * 1024;

// Uploads attached to merchant $1's live content: materials and videos of
// live chapters of its live classes, attachments of their live assignments,
// and files of its live digital products. Images, submissions, certificates
// and CVs are not storage. UNION keeps each upload once.
const MERCHANT_CONTENT_ASSETS_SQL = `
  SELECT resource.asset_id FROM file_resources resource
  INNER JOIN chapters chapter ON chapter.id = resource.chapter_id AND chapter.deleted_at IS NULL
  INNER JOIN classes class ON class.id = chapter.class_id AND class.deleted_at IS NULL
  WHERE class.merchant_id = $1 AND resource.deleted_at IS NULL AND resource.asset_id IS NOT NULL
  UNION
  SELECT video.asset_id FROM videos video
  INNER JOIN chapters chapter ON chapter.id = video.chapter_id AND chapter.deleted_at IS NULL
  INNER JOIN classes class ON class.id = chapter.class_id AND class.deleted_at IS NULL
  WHERE class.merchant_id = $1 AND video.deleted_at IS NULL AND video.asset_id IS NOT NULL
  UNION
  SELECT assignment.resource_asset_id FROM assignments assignment
  INNER JOIN classes class ON class.id = assignment.class_id AND class.deleted_at IS NULL
  WHERE class.merchant_id = $1 AND assignment.deleted_at IS NULL
    AND assignment.resource_asset_id IS NOT NULL
  UNION
  SELECT file.asset_id FROM digital_files file
  INNER JOIN products product ON product.id = file.product_id AND product.deleted_at IS NULL
  WHERE product.merchant_id = $1 AND file.deleted_at IS NULL AND file.asset_id IS NOT NULL
`;

/**
 * Bytes used by a merchant's content, counting `extraAssetIds` too (uploads
 * accepted earlier in the same transaction whose rows are not written yet).
 * `counted` tells whether `assetId` is already part of that total.
 */
export async function merchantStorageUse(
  manager: Pick<EntityManager, 'query'>,
  merchantId: string,
  assetId: string | null = null,
  extraAssetIds: string[] = [],
): Promise<{ usedBytes: number; counted: boolean }> {
  const [row] = await manager.query(
    `SELECT COALESCE(sum(asset.size_bytes), 0)::bigint AS used_bytes,
            COALESCE(bool_or(asset.id = $2), false) AS counted
     FROM (${MERCHANT_CONTENT_ASSETS_SQL}
           UNION SELECT unnest($3::uuid[])) used
     INNER JOIN file_assets asset ON asset.id = used.asset_id AND asset.deleted_at IS NULL`,
    [merchantId, assetId, extraAssetIds],
  );
  return { usedBytes: Number(row.used_bytes), counted: row.counted };
}

// Uploads accepted per transaction and merchant, so several files attached in
// one request (rows written after all checks) are counted together.
const acceptedInTransaction = new WeakMap<object, Map<string, Set<string>>>();

/**
 * Rejects a content upload that would take the merchant over its level's
 * storage quota. A per-merchant advisory lock, held to the end of the
 * caller's transaction, makes concurrent attaches check one after another.
 * An upload the merchant already uses adds nothing.
 */
export async function assertWithinStorageQuota(
  manager: EntityManager,
  merchant: { id: string; level: MerchantStorageLevel },
  asset: { id: string; sizeBytes: string | number },
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `merchant-storage:${merchant.id}`,
  ]);
  // Only a transaction's own query runner scopes the tally; callers always
  // attach inside a transaction, and outside one nothing is remembered.
  const runner = manager.queryRunner?.isTransactionActive
    ? manager.queryRunner
    : null;
  const byMerchant =
    (runner && acceptedInTransaction.get(runner)) ??
    new Map<string, Set<string>>();
  if (runner) acceptedInTransaction.set(runner, byMerchant);
  const accepted = byMerchant.get(merchant.id) ?? new Set<string>();

  const { usedBytes, counted } = await merchantStorageUse(
    manager,
    merchant.id,
    asset.id,
    [...accepted],
  );
  const rule = MERCHANT_LEVEL_RULES[merchant.level];
  if (
    !counted &&
    usedBytes + Number(asset.sizeBytes) > rule.storageQuotaBytes
  ) {
    throw new BadRequestException(
      `Storage is full: the ${rule.label} level allows ${gigabytes(rule.storageQuotaBytes)} GB and ${gigabytes(usedBytes)} GB is in use`,
    );
  }
  accepted.add(asset.id);
  byMerchant.set(merchant.id, accepted);
}

function gigabytes(bytes: number): string {
  const value = bytes / GIBIBYTE;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
