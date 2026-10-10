import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'certification_partnership_requests' })
export class CertificationPartnershipRequest extends BaseEntity {
  @Column({ name: 'institution_name', type: 'varchar', length: 200 })
  institutionName: string;

  @Column({ type: 'text', nullable: true })
  profile: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 32 })
  phone: string;

  // Null when the request came from a visitor who was not signed in.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;
}
