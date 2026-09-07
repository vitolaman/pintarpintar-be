import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'issued_certificates' })
export class IssuedCertificate extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'access_id' })
  accessId: string;

  @Column({ name: 'certificate_number' })
  certificateNumber: string;

  @Column({ name: 'certificate_asset_id', type: 'uuid', nullable: true })
  certificateAssetId: string | null;

  @Column({ name: 'issued_at', type: 'timestamp' })
  issuedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
