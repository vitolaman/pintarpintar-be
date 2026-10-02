import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A message for one user. Rows are written for the PM's email sender; there
// is no read API yet.
@Entity({ name: 'notifications' })
export class Notification extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'ref_type', type: 'varchar', nullable: true })
  refType: string | null;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;
}
