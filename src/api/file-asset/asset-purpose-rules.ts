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
import { assertWithinStorageQuota } from '../merchant-level/merchant-storage';

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const OCTET_STREAM = 'application/octet-stream';
const FILE_NOT_AVAILABLE =
  'The uploaded file was not found, is not yours, or has not finished uploading';

export type FileKind =
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

// Types a field refuses although it accepts any other file.
type BlockedTypes = {
  extensions: string[];
  mimeTypes: string[];
  // Shown to the user when a blocked file is attached.
  message: string;
  // Swagger and error text for what the field accepts.
  description: string;
};

type AssetPurposeRule = {
  // 'merchant_level': the owning merchant's per-file limit for its level.
  maxBytes: number | 'merchant_level';
  visibility: AssetVisibility;
} & (
  | {
      kinds: FileKind[];
      // Narrows the kinds to these extensions when set.
      extensions?: string[];
    }
  | { blocked: BlockedTypes }
);

// Product files, class materials, assignment attachments and submissions may
// be any file someone downloads, except programs, scripts, installers,
// shortcuts and web pages, which could harm whoever opens them (user decisions
// 2026-10-06: the variety of these files is too large for a list).
const UNSAFE_FILES: BlockedTypes = {
  extensions: [
    // programs and libraries
    'exe',
    'msi',
    'msix',
    'com',
    'scr',
    'pif',
    'cpl',
    'dll',
    'sys',
    'drv',
    // scripts
    'bat',
    'cmd',
    'ps1',
    'psm1',
    'vbs',
    'vbe',
    'js',
    'jse',
    'mjs',
    'wsf',
    'wsh',
    'hta',
    'msc',
    'sh',
    'bash',
    'zsh',
    'csh',
    'command',
    'run',
    'bin',
    // shortcuts and system settings
    'lnk',
    'reg',
    'inf',
    // app packages and installers
    'jar',
    'apk',
    'aab',
    'xapk',
    'ipa',
    'app',
    'dmg',
    'pkg',
    'deb',
    'rpm',
    'appimage',
    // web pages
    'html',
    'htm',
    'xhtml',
    'mht',
    'mhtml',
  ],
  mimeTypes: [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-ms-installer',
    'application/x-msi',
    'application/x-dosexec',
    'application/x-executable',
    'application/x-mach-binary',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-bat',
    'application/vnd.android.package-archive',
    'application/java-archive',
    'application/x-apple-diskimage',
    'application/javascript',
    'text/javascript',
    'text/html',
    'application/xhtml+xml',
  ],
  message:
    "Programs, scripts, installers and web pages aren't allowed (for example EXE, BAT, APK, HTML)",
  description:
    'any file type except programs, scripts, installers and web pages (for example EXE, BAT, APK, HTML)',
};

const IMAGE_ONLY: FileKind[] = ['image'];
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
    blocked: UNSAFE_FILES,
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  assignment_resource: {
    blocked: UNSAFE_FILES,
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  class_video: {
    kinds: ['video'],
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  digital_file: {
    blocked: UNSAFE_FILES,
    maxBytes: 'merchant_level',
    visibility: 'private',
  },
  submission_file: {
    blocked: UNSAFE_FILES,
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

/** The kind of an uploaded file, from its name and reported type. */
export function fileKindOf(file: {
  filename: string;
  mimeType: string | undefined;
}): FileKind | null {
  return resolveKind(
    fileExtension(file.filename),
    (file.mimeType ?? '').toLowerCase(),
  );
}

export type UploadLimit = {
  level: MerchantStorageLevel | null;
  maxBytes: number;
};

function allowedExtensions(rule: {
  kinds: FileKind[];
  extensions?: string[];
}): string[] {
  return (
    rule.extensions ??
    Object.entries(FILE_FORMATS)
      .filter(([, format]) => rule.kinds.includes(format.kind))
      .map(([extension]) => extension)
  );
}

function joinWithOr(items: string[]): string {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

function gigabytes(bytes: number): string {
  return `${bytes / GIBIBYTE} GB`;
}

/** The accepted file types of a field, for example "PNG, JPG, JPEG or WEBP". */
export function allowedTypesText(purpose: AssetPurpose): string {
  const rule: AssetPurposeRule = ASSET_PURPOSE_RULES[purpose];
  if ('blocked' in rule) return rule.blocked.description;
  return joinWithOr(
    allowedExtensions(rule).map((extension) => extension.toUpperCase()),
  );
}

/** The size limit of a field, for example "4 MB". */
export function sizeLimitText(purpose: AssetPurpose): string {
  const rule: AssetPurposeRule = ASSET_PURPOSE_RULES[purpose];
  if (rule.maxBytes !== 'merchant_level') {
    return `${rule.maxBytes / MEBIBYTE} MB`;
  }
  const levels = Object.values(MERCHANT_LEVEL_RULES).map(
    (level) => `${level.label} ${gigabytes(level.maxUploadBytes)}`,
  );
  return `the store's level limit (${levels.join(', ')})`;
}

/** Swagger text for a request field that takes an uploaded file. */
export function assetFieldDescription(
  purpose: AssetPurpose,
  note?: string,
): string {
  const rule = `An asset_id from POST /api/v1/upload/complete: ${allowedTypesText(purpose)}, up to ${sizeLimitText(purpose)}.`;
  return note ? `${rule} ${note}` : rule;
}

/**
 * `merchantLimit` is the owning merchant's limit for purposes sized by
 * merchant level; without it the largest level limit applies. Messages name
 * the rule in plain words because they are shown to end users.
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

  if ('blocked' in rule) {
    if (!extension) {
      throw new BadRequestException(
        'The file needs an extension, such as .pdf or .zip',
      );
    }
    if (
      rule.blocked.extensions.includes(extension) ||
      rule.blocked.mimeTypes.includes(mimeType)
    ) {
      throw new BadRequestException(rule.blocked.message);
    }
    // A known format must still match its reported type, as for listed fields.
    if (FILE_FORMATS[extension] && !kind) {
      throw new BadRequestException(
        `The file's content does not match its .${extension} extension`,
      );
    }
  } else {
    const extensionAllowed =
      !rule.extensions || rule.extensions.includes(extension);
    if (!extensionAllowed || !kind || !rule.kinds.includes(kind)) {
      throw new BadRequestException(
        `Allowed file types: ${allowedTypesText(purpose)}`,
      );
    }
  }
  if (rule.maxBytes === 'merchant_level') {
    const limit = merchantLimit ?? {
      level: null,
      maxBytes: LARGEST_UPLOAD_BYTES,
    };
    if (file.sizeBytes > limit.maxBytes) {
      throw new BadRequestException(
        limit.level
          ? `The file must be ${gigabytes(limit.maxBytes)} or smaller on the ${MERCHANT_LEVEL_RULES[limit.level].label} merchant level`
          : `The file must be ${gigabytes(limit.maxBytes)} or smaller`,
      );
    }
  } else if (file.sizeBytes > rule.maxBytes) {
    throw new BadRequestException(
      `The file must be ${sizeLimitText(purpose)} or smaller`,
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
    throw new BadRequestException(FILE_NOT_AVAILABLE);
  }
  const owner =
    ASSET_PURPOSE_RULES[purpose].maxBytes === 'merchant_level'
      ? await ownerMerchant(manager, purpose, limitOwner)
      : undefined;
  assertFileFitsPurpose(
    purpose,
    {
      filename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
    },
    owner && {
      level: owner.level,
      maxBytes: MERCHANT_LEVEL_RULES[owner.level].maxUploadBytes,
    },
  );
  if (owner) await assertWithinStorageQuota(manager, owner, asset);

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
      `This file is already used as a ${asset.visibility} file; upload it again for this field`,
    );
  }
  return asset;
}

// The merchant that owns the class or product a content file is attached
// to; its level sets the per-file limit and the storage quota (no Pro
// subscription exists yet).
async function ownerMerchant(
  manager: EntityManager,
  purpose: AssetPurpose,
  owner: UploadLimitOwner | undefined,
): Promise<{ id: string; level: MerchantStorageLevel }> {
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
    throw new BadRequestException(FILE_NOT_AVAILABLE);
  }
  return { id: merchant.id, level: merchant.storageLevel };
}
