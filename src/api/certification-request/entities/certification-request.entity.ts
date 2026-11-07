import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'certification_requests' })
export class CertificationRequest extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'organization_name', type: 'varchar', length: 200 })
  organizationName: string;

  @Column({ name: 'organization_profile', type: 'text', nullable: true })
  organizationProfile: string | null;

  @Column({ name: 'organization_email', type: 'varchar', length: 255 })
  organizationEmail: string;

  @Column({ name: 'organization_phone', type: 'varchar', length: 32 })
  organizationPhone: string;
}
