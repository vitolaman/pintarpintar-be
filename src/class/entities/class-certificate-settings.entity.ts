import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base-entity';
import type { CertificateDeliveryMode } from '../certificate-settings';

// Absent settings mean manual issuing, 80% attendance, a score of 75 and the
// Pintar Pintar template with no custom fields.
@Entity({ name: 'class_certificate_settings' })
export class ClassCertificateSettings extends BaseEntity {
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @Column({ name: 'auto_issue', type: 'boolean', default: false })
  auto_issue: boolean;

  @Column({ name: 'min_attendance_percent', type: 'integer', default: 80 })
  min_attendance_percent: number;

  @Column({ name: 'min_score', type: 'integer', default: 75 })
  min_score: number;

  @Column({ name: 'delivery_mode', type: 'varchar', default: 'template' })
  delivery_mode: CertificateDeliveryMode;

  @Column({
    name: 'certificate_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  certificate_url: string | null;

  @Column({
    name: 'number_prefix',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  number_prefix: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 150, nullable: true })
  class_name: string | null;

  @Column({ name: 'mentor_name', type: 'varchar', length: 150, nullable: true })
  mentor_name: string | null;

  @Column({ name: 'signature_asset_id', type: 'uuid', nullable: true })
  signature_asset_id: string | null;

  @Column({ name: 'show_score', type: 'boolean', default: false })
  show_score: boolean;
}
