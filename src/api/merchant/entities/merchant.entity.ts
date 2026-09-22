import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'merchants' })
export class Merchant extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'store_name' })
  storeName: string;

  @Column({ name: 'store_description', type: 'text', nullable: true })
  storeDescription: string | null;

  @Column({ name: 'lifetime_earnings', type: 'numeric', default:0 })
  lifetimeEarnings: string;

  @Column({ type: 'numeric', default:0 })
  balance: string;

  @Column()
  status: string;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;
}
