import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'merchant_wallets' })
export class MerchantWallet extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid', unique: true })
  merchantId: string;

  @Column({ type: 'numeric', default: 0 })
  balance: string;
}
