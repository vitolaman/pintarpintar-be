import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
import {
  ObjectStorage,
  createObjectStorage,
} from '../../common/storage/object-storage';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';
import { OwnedProductDto } from './dto/learning-product.dto';

// Buyers keep their product after the merchant deletes or unpublishes it;
// only active, unexpired access counts.
const OWNED_PRODUCT_SQL = `
  SELECT product.id, product.title, product.description,
         cover.object_key AS cover_object_key, product.post_purchase_instructions,
         merchant.id AS merchant_id, merchant.store_name AS merchant_name,
         profile.slug AS merchant_slug,
         category.name AS category_name, category.slug AS category_slug,
         file.file_format, file.file_size, file.file_url,
         file_asset.object_key AS file_object_key,
         file_asset.original_filename AS file_name,
         access.granted_at, access.expires_at
  FROM user_access access
  INNER JOIN products product ON product.id = access.product_id
  INNER JOIN merchants merchant ON merchant.id = product.merchant_id
  LEFT JOIN merchant_profiles profile
    ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets cover ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT category.name, category.slug
    FROM product_categories link
    INNER JOIN categories category ON category.id = link.category_id AND category.deleted_at IS NULL
    WHERE link.product_id = product.id AND link.deleted_at IS NULL
    ORDER BY link.updated_at DESC, category.name
    LIMIT 1
  ) category ON true
  LEFT JOIN digital_files file ON file.product_id = product.id AND file.deleted_at IS NULL
  LEFT JOIN file_assets file_asset
    ON file_asset.id = file.asset_id AND file_asset.deleted_at IS NULL
  WHERE access.user_id = $1 AND access.product_id = $2 AND access.deleted_at IS NULL
    AND (access.expires_at IS NULL OR access.expires_at > now())
`;

@Injectable()
export class LearningProductService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findProduct(userId: string, productId: string) {
    const [row] = await this.dataSource.query(OWNED_PRODUCT_SQL, [
      userId,
      productId,
    ]);
    if (!row) throw new NotFoundException('Digital product not found');

    const hasFile = row.file_format !== null;
    const data: OwnedProductDto = {
      id: row.id,
      title: row.title,
      description: row.description,
      cover_url: assetUrl(row.cover_object_key),
      category: row.category_slug
        ? { name: row.category_name, slug: row.category_slug }
        : null,
      merchant: {
        id: row.merchant_id,
        name: row.merchant_name,
        slug: row.merchant_slug,
      },
      post_purchase_instructions: row.post_purchase_instructions,
      access: { granted_at: row.granted_at, expires_at: row.expires_at },
      file: hasFile
        ? {
            name: row.file_name ?? row.file_url.split('/').pop(),
            format: row.file_format.toUpperCase(),
            size: Number(row.file_size),
            download_url: row.file_object_key
              ? await signedDownloadUrl(
                  this.storage,
                  row.file_object_key,
                  row.file_name,
                )
              : /^https?:\/\//.test(row.file_url)
                ? row.file_url
                : null,
          }
        : null,
    };
    return { data, responseMessage: 'Get owned digital product success' };
  }
}
