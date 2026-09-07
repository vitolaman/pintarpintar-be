import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'file_assets' })
export class FileAsset extends BaseEntity {
  @Column({ name: 'uploaded_by_user_id', type: 'uuid', nullable: true })
  uploadedByUserId: string | null;

  @Column({ name: 'storage_provider' })
  storageProvider: string;

  @Column({ name: 'object_key' })
  objectKey: string;

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ nullable: true })
  checksumSha256: string | null;

  @Column()
  visibility: string;

  @Column()
  status: string;
}
