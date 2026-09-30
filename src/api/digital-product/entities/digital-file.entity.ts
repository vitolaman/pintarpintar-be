import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// One row per product (UNIQUE product_id). file_url holds the private object
// key of the uploaded file, never a public URL.
@Entity({ name: 'digital_files' })
export class DigitalFile extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'file_format' })
  fileFormat: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize: number;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;
}
