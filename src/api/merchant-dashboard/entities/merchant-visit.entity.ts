import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// One visit per merchant, visitor and Asia/Jakarta day. The visitor key is
// `user:<id>` for a logged-in caller, otherwise `anon:<browser id>`.
@Entity({ name: 'merchant_visits' })
export class MerchantVisit extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'visitor_key', type: 'varchar', length: 64 })
  visitorKey: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'visit_date', type: 'date' })
  visitDate: string;
}
