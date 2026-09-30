import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export enum MerchantPayoutStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * A withdrawal ("Tarik Saldo") of settled income to a payout account. It is
 * processed manually; the transfer is the amount minus the fee.
 */
@Entity({ name: 'merchant_payouts' })
export class MerchantPayout extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'payout_account_id', type: 'uuid', nullable: true })
  payoutAccountId: string | null;

  @Column({ type: 'numeric' })
  amount: string;

  @Column({ name: 'fee_amount', type: 'numeric', default: 0 })
  feeAmount: string;

  @Column({ type: 'varchar' })
  status: string;

  // Masked destination kept as text so history survives account changes.
  @Column({ name: 'destination_bank_account', type: 'varchar' })
  destinationBankAccount: string;

  @Column({ name: 'requested_at', type: 'timestamp', default: () => 'now()' })
  requestedAt: Date;
}
