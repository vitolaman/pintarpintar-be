import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'merchant_skills' })
export class MerchantSkill extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column()
  name: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
}
