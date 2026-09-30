import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base-entity';

// Absent settings mean manual issuing, 80% attendance and a score of 75.
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
}
