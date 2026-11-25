import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MerchantStorageLevel } from '../merchant/entities/merchant.entity';
import { MERCHANT_LEVEL_RULES } from '../merchant-level/merchant-level-rules';
import { hasProBenefits, merchantProStatus } from '../pro/pro-status';
import { ASSET_PURPOSE_RULES } from './asset-purpose-rules';

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;

// The largest fixed field limit (a learner submission, 500 MiB). Every
// signed-in user may need it, so it is the smallest cap of any upload.
export const LARGEST_FIXED_UPLOAD_BYTES = Math.max(
  ...Object.values(ASSET_PURPOSE_RULES)
    .map((rule) => rule.maxBytes)
    .filter((maxBytes): maxBytes is number => typeof maxBytes === 'number'),
);

// Merchants whose content (materials, videos, assignment files, product
// files) the user can attach uploads to: the user's own merchant, and the
// merchants of classes the user tutors as an active mentor.
const CONTENT_MERCHANTS_SQL = `
  SELECT merchant.id, merchant.storage_level
  FROM merchants merchant
  WHERE merchant.user_id = $1 AND merchant.deleted_at IS NULL
  UNION
  SELECT merchant.id, merchant.storage_level
  FROM class_mentors link
  INNER JOIN mentors mentor
    ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
    AND mentor.status = 'active'
  INNER JOIN classes class ON class.id = link.class_id AND class.deleted_at IS NULL
  INNER JOIN merchants merchant
    ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
  WHERE mentor.user_id = $1 AND link.deleted_at IS NULL
`;

export type ContentMerchant = {
  level: MerchantStorageLevel;
  hasProBenefits: boolean;
};

/**
 * The largest file a field could still accept from this uploader, so an
 * upload bigger than it could never be attached. A merchant's content takes
 * its level's per-file limit; a Pro merchant has no per-file limit, so its
 * level's storage quota bounds the file instead (the quota is checked again,
 * against the space in use, when the file is attached).
 */
export function uploadSizeCapFor(merchants: ContentMerchant[]): number {
  const merchantCaps = merchants.map((merchant) => {
    const rule = MERCHANT_LEVEL_RULES[merchant.level];
    return merchant.hasProBenefits
      ? rule.storageQuotaBytes
      : rule.maxUploadBytes;
  });
  return Math.max(LARGEST_FIXED_UPLOAD_BYTES, ...merchantCaps);
}

export async function uploadSizeCap(
  manager: EntityManager,
  userId: string,
  now = new Date(),
): Promise<number> {
  const rows: Array<{ id: string; storage_level: MerchantStorageLevel }> =
    await manager.query(CONTENT_MERCHANTS_SQL, [userId]);
  const merchants = await Promise.all(
    rows.map(async (row) => ({
      level: row.storage_level,
      hasProBenefits: hasProBenefits(
        await merchantProStatus(manager, row.id, now),
      ),
    })),
  );
  return uploadSizeCapFor(merchants);
}

/** "500 MB", "1 GB", "30 GB": the units the field size messages use. */
export function uploadSizeText(bytes: number): string {
  if (bytes >= GIBIBYTE && bytes % GIBIBYTE === 0) {
    return `${bytes / GIBIBYTE} GB`;
  }
  return `${Math.floor(bytes / MEBIBYTE)} MB`;
}

export function uploadTooLarge(capBytes: number): BadRequestException {
  return new BadRequestException(
    `The file must be ${uploadSizeText(capBytes)} or smaller`,
  );
}

/** Swagger text for the upload routes, built from the level rules. */
export function uploadSizeCapDescription(): string {
  const levels = Object.values(MERCHANT_LEVEL_RULES);
  const perFile = levels
    .map((rule) => `${rule.label} ${uploadSizeText(rule.maxUploadBytes)}`)
    .join(', ');
  const quotas = levels
    .map((rule) => `${rule.label} ${uploadSizeText(rule.storageQuotaBytes)}`)
    .join(', ');
  return `A file may be at most ${uploadSizeText(LARGEST_FIXED_UPLOAD_BYTES)}, or more when the caller can attach it to a merchant's content (its own store, or a class it tutors): that merchant's per-file level limit (${perFile}), or while the merchant is Pro its level's storage quota (${quotas}). Each form field still applies its own limit when the file is attached.`;
}
