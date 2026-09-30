import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'merchant_wallets' })
export class MerchantWallet extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid', unique: true })
  merchantId: string;

  // Current balance, including income still in its clearing period.
  @Column({ name: 'earning_balance', type: 'numeric', default: 0 })
  earningBalance: string;

  // Withdrawable part of the earning balance.
  @Column({ name: 'settled_balance', type: 'numeric', default: 0 })
  settledBalance: string;

  @Column({ name: 'lifetime_earnings', type: 'numeric', default: 0 })
  lifetimeEarnings: string;
}
