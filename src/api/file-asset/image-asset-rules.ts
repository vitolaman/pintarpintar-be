import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';

const MEBIBYTE = 1024 * 1024;

export const imagePurposes = [
  'merchant_logo',
  'merchant_banner',
  'merchant_landing_background',
  'user_avatar',
] as const;

export type ImagePurpose = (typeof imagePurposes)[number];

export const IMAGE_SIZE_LIMITS: Record<ImagePurpose, number> = {
  merchant_logo: 2 * MEBIBYTE,
  merchant_banner: 4 * MEBIBYTE,
  merchant_landing_background: 4 * MEBIBYTE,
  user_avatar: 2 * MEBIBYTE,
};

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function assertImageWithinLimit(
  purpose: ImagePurpose,
  mimeType: string | undefined,
  sizeBytes: number,
): void {
  if (!mimeType || !IMAGE_MIME_TYPES.includes(mimeType.toLowerCase())) {
    throw new BadRequestException('Only PNG, JPEG, or WEBP images are allowed');
  }
  if (sizeBytes > IMAGE_SIZE_LIMITS[purpose]) {
    throw new BadRequestException(
      `Image exceeds the ${IMAGE_SIZE_LIMITS[purpose] / MEBIBYTE} MB limit for ${purpose}`,
    );
  }
}

/**
 * Ensures a referenced image asset belongs to the caller, is publicly usable,
 * and fits the purpose; used before storing the reference.
 */
export async function assertOwnedImageAsset(
  manager: EntityManager,
  userId: string,
  assetId: string,
  purpose: ImagePurpose,
): Promise<void> {
  const asset = await manager.findOneBy(FileAsset, { id: assetId });
  if (
    !asset ||
    asset.uploadedByUserId !== userId ||
    asset.status !== 'active' ||
    asset.visibility !== 'public'
  ) {
    throw new BadRequestException(
      `Image asset for ${purpose} is not available`,
    );
  }
  assertImageWithinLimit(purpose, asset.mimeType, Number(asset.sizeBytes));
}
