import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';
import {
  Merchant,
  MerchantStorageLevel,
} from '../merchant/entities/merchant.entity';
import { Class } from '~/class/entities/class.entity';
import {
  LARGEST_UPLOAD_BYTES,
  MERCHANT_LEVEL_RULES,
} from '../merchant-level/merchant-level-rules';

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const OCTET_STREAM = 'application/octet-stream';

type FileKind =
  | 'image'
  | 'document'
  | 'archive'
  | 'cad'
  | 'spreadsheet'
  | 'presentation'
  | 'design'
  | 'video';

type FileFormat = { kind: FileKind; mimeTypes: string[] };

// Keyed by lower-case file extension. Browsers report many of the non-image
// formats (DWG, RAR, PSD, …) as application/octet-stream, which is accepted
// only together with a known non-image extension.
const FILE_FORMATS: Record<string, FileFormat> = {
  png: { kind: 'image', mimeTypes: ['image/png'] },
  jpg: { kind: 'image', mimeTypes: ['image/jpeg'] },
  jpeg: { kind: 'image', mimeTypes: ['image/jpeg'] },
  webp: { kind: 'image', mimeTypes: ['image/webp'] },
  pdf: { kind: 'document', mimeTypes: ['application/pdf'] },
  doc: { kind: 'document', mimeTypes: ['application/msword'] },
  docx: {
    kind: 'document',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  txt: { kind: 'document', mimeTypes: ['text/plain'] },
  epub: { kind: 'document', mimeTypes: ['application/epub+zip'] },
  zip: {
    kind: 'archive',
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
  },
  rar: {
    kind: 'archive',
    mimeTypes: ['application/vnd.rar', 'application/x-rar-compressed'],
  },
  '7z': { kind: 'archive', mimeTypes: ['application/x-7z-compressed'] },
  dwg: {
    kind: 'cad',
    mimeTypes: ['image/vnd.dwg', 'image/x-dwg', 'application/acad'],
  },
  dxf: { kind: 'cad', mimeTypes: ['image/vnd.dxf', 'application/dxf'] },
  skp: { kind: 'cad', mimeTypes: ['application/vnd.sketchup.skp'] },
  xls: { kind: 'spreadsheet', mimeTypes: ['application/vnd.ms-excel'] },
  xlsx: {
    kind: 'spreadsheet',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  csv: { kind: 'spreadsheet', mimeTypes: ['text/csv'] },
  ppt: { kind: 'presentation', mimeTypes: ['application/vnd.ms-powerpoint'] },
  pptx: {
    kind: 'presentation',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  psd: {
    kind: 'design',
    mimeTypes: ['image/vnd.adobe.photoshop', 'application/x-photoshop'],
  },
  ai: {
    kind: 'design',
    mimeTypes: ['application/postscript', 'application/illustrator'],
  },
  eps: { kind: 'design', mimeTypes: ['application/postscript'] },
  cdr: {
    kind: 'design',
    mimeTypes: ['application/x-coreldraw', 'application/cdr'],
  },
  mp4: { kind: 'video', mimeTypes: ['video/mp4'] },
  mov: { kind: 'video', mimeTypes: ['video/quicktime'] },
  webm: { kind: 'video', mimeTypes: ['video/webm'] },
};

type AssetVisibility = 'public' | 'private';

// A registered upload not attached to any field yet. Its first field decides
// whether it becomes public or private.
export const PENDING_VISIBILITY = 'pending';

type AssetPurposeRule = {
  kinds: FileKind[];
  // 'merchant_level': the owning merchant's per-file limit for its level.
  maxBytes: number | 'merchant_level';
  visibility: AssetVisibility;
  // Narrows the kinds to these extensions when set.
  extensions?: string[];
};

const IMAGE_ONLY: FileKind[] = ['image'];
const CLASS_FILE_KINDS: FileKind[] = ['document', 'archive', 'image', 'cad'];
const DIGITAL_FILE_KINDS: FileKind[] = [
  ...CLASS_FILE_KINDS,
  'spreadsheet',
  'presentation',
  'design',
  'video',
];

export const ASSET_PURPOSE_RULES = {
  merchant_logo: {
    kinds: IMAGE_ONLY,
    maxBytes: 2 * MEBIBYTE,
    visibility: 'public',
  },
  merchant_banner: {
    kinds: IMAGE_ONLY,
    maxBytes: 4 * MEBIBYTE,
    visibility: 'public',
  },
  merchant_landing_background: {
    kinds: IMAGE_ONLY,
    maxBytes: 4 * MEBIBYTE,
    visibility: 'public',
  },
  user_avatar: {
    kinds: IMAGE_ONLY,
    maxBytes: 2 * MEBIBYTE,
    visibility: 'public',
  },
  class_cover: {
    kinds: IMAGE_ONLY,
    maxBytes: 4 * MEBIBYTE,
    visibility: 'public',
  },
  product_cover: {
    kinds: IMAGE_ONLY,
    maxBytes: 4 * MEBIBYTE,
    visibility: 'public',
  },
  class_resource: {
    kinds: CLASS_FILE_KINDS,
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  assignment_resource: {
    kinds: CLASS_FILE_KINDS,
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  digital_file: {
    kinds: DIGITAL_FILE_KINDS,
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  submission_file: {
    kinds: ['document', 'archive', 'cad'],
    extensions: ['pdf', 'dwg', 'zip'],
    maxBytes: 20 * MEBIBYTE,
    visibility: 'private',
  },
  certificate_file: {
    kinds: ['document', 'image'],
    extensions: ['pdf', 'png', 'jpg', 'jpeg'],
    maxBytes: 10 * MEBIBYTE,
    visibility: 'private',
  },
  // The CV of a job application; a registered mentor CV also qualifies.
  application_cv: {
    kinds: ['document'],
    extensions: ['pdf', 'doc', 'docx'],
    maxBytes: 10 * MEBIBYTE,
    visibility: 'private',
  },
} satisfies Record<string, AssetPurposeRule>;

export type AssetPurpose = keyof typeof ASSET_PURPOSE_RULES;

export const assetPurposes = Object.keys(ASSET_PURPOSE_RULES) as AssetPurpose[];

export type AssetFileFacts = {
  filename: string;
  mimeType: string | undefined;
  sizeBytes: number;
};

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

function kindOfMimeType(mimeType: string): FileKind | null {
  const format = Object.values(FILE_FORMATS).find((candidate) =>
    candidate.mimeTypes.includes(mimeType),
  );
  return format?.kind ?? null;
}

// The extension and the reported type must agree on the kind of file; the
// exact format may differ (a .png saved as WEBP is still an image).
function resolveKind(extension: string, mimeType: string): FileKind | null {
  const byExtension = FILE_FORMATS[extension];
  if (!byExtension) {
    // Keys without a recognised extension (e.g. a pasted image named "blob")
    // are identified by their reported type alone.
    return kindOfMimeType(mimeType);
  }
  if (mimeType === OCTET_STREAM) {
    return byExtension.kind === 'image' ? null : byExtension.kind;
  }
  return kindOfMimeType(mimeType) === byExtension.kind
    ? byExtension.kind
    : null;
}

export type UploadLimit = {
  level: MerchantStorageLevel | null;
  maxBytes: number;
};

/**
 * `merchantLimit` is the owning merchant's limit for purposes sized by
 * merchant level; without it the largest level limit applies.
 */
export function assertFileFitsPurpose(
  purpose: AssetPurpose,
  file: AssetFileFacts,
  merchantLimit?: UploadLimit,
): void {
  const rule: AssetPurposeRule = ASSET_PURPOSE_RULES[purpose];
  const mimeType = (file.mimeType ?? '').toLowerCase();
  const extension = fileExtension(file.filename);
  const kind = resolveKind(extension, mimeType);

  if (rule.extensions && !rule.extensions.includes(extension)) {
    throw new BadRequestException(
      `Only ${rule.extensions.join(', ').toUpperCase()} files are allowed for ${purpose}`,
    );
  }
  if (!kind || !rule.kinds.includes(kind)) {
    throw new BadRequestException(
      rule.kinds === IMAGE_ONLY
        ? 'Only PNG, JPEG, or WEBP images are allowed'
        : `This file type is not allowed for ${purpose}`,
    );
  }
  if (rule.maxBytes === 'merchant_level') {
    const limit = merchantLimit ?? {
      level: null,
      maxBytes: LARGEST_UPLOAD_BYTES,
    };
    if (file.sizeBytes > limit.maxBytes) {
      const gigabytes = limit.maxBytes / GIBIBYTE;
      throw new BadRequestException(
        limit.level
          ? `File exceeds the ${gigabytes} GB limit of the ${MERCHANT_LEVEL_RULES[limit.level].label} merchant level`
          : `File exceeds the ${gigabytes} GB limit for ${purpose}`,
      );
    }
  } else if (file.sizeBytes > rule.maxBytes) {
    throw new BadRequestException(
      `File exceeds the ${rule.maxBytes / MEBIBYTE} MB limit for ${purpose}`,
    );
  }
}

export function purposeVisibility(purpose: AssetPurpose): AssetVisibility {
  return ASSET_PURPOSE_RULES[purpose].visibility;
}

/**
 * Ensures a referenced asset belongs to the caller, is active, and fits the
 * field's purpose (type and size). A pending asset takes the purpose's
 * visibility on its first attach; an asset already public or private can only
 * go to fields of that same visibility, so a private file never reaches a
 * public field. The claim is a conditional update, so concurrent attaches of
 * one pending asset leave it with a single visibility.
 */
export type UploadLimitOwner = { merchantId: string } | { classId: string };

export async function assertOwnedAsset(
  manager: EntityManager,
  userId: string,
  assetId: string,
  purpose: AssetPurpose,
  limitOwner?: UploadLimitOwner,
): Promise<FileAsset> {
  const asset = await manager.findOneBy(FileAsset, { id: assetId });
  if (
    !asset ||
    asset.uploadedByUserId !== userId ||
    asset.status !== 'active'
  ) {
    throw new BadRequestException(`File asset for ${purpose} is not available`);
  }
  const merchantLimit =
    ASSET_PURPOSE_RULES[purpose].maxBytes === 'merchant_level'
      ? await ownerUploadLimit(manager, purpose, limitOwner)
      : undefined;
  assertFileFitsPurpose(
    purpose,
    {
      filename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
    },
    merchantLimit,
  );

  const visibility = purposeVisibility(purpose);
  if (asset.visibility === PENDING_VISIBILITY) {
    await manager.update(
      FileAsset,
      { id: asset.id, visibility: PENDING_VISIBILITY },
      { visibility },
    );
    const claimed = await manager.findOneBy(FileAsset, { id: asset.id });
    asset.visibility = claimed?.visibility ?? asset.visibility;
  }
  if (asset.visibility !== visibility) {
    throw new BadRequestException(
      `This file is already used as a ${asset.visibility} file; upload it again for ${purpose}`,
    );
  }
  return asset;
}

// The per-file limit of the merchant that owns the class or product a
// content file is attached to. While no Pro subscription exists, every
// merchant has its level's limit.
async function ownerUploadLimit(
  manager: EntityManager,
  purpose: AssetPurpose,
  owner: UploadLimitOwner | undefined,
): Promise<UploadLimit> {
  if (!owner) {
    throw new Error(`${purpose} needs the owning merchant or class`);
  }
  let merchantId: string | undefined;
  if ('merchantId' in owner) {
    merchantId = owner.merchantId;
  } else {
    const cls = await manager.findOneBy(Class, { id: owner.classId });
    merchantId = cls?.merchant_id;
  }
  const merchant = merchantId
    ? await manager.findOneBy(Merchant, { id: merchantId })
    : null;
  if (!merchant) {
    throw new BadRequestException(`File asset for ${purpose} is not available`);
  }
  return {
    level: merchant.storageLevel,
    maxBytes: MERCHANT_LEVEL_RULES[merchant.storageLevel].maxUploadBytes,
  };
}
