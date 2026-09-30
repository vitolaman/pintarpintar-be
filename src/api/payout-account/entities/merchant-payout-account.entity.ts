import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'merchant_payout_accounts' })
export class MerchantPayoutAccount extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'bank_name', type: 'varchar' })
  bankName: string;

  @Column({ name: 'account_holder_name', type: 'varchar' })
  accountHolderName: string;

  // AES-256-GCM envelope; the plain number is never stored or returned.
  @Column({ name: 'encrypted_account_number', type: 'text' })
  encryptedAccountNumber: string;

  @Column({ name: 'masked_account_number', type: 'varchar' })
  maskedAccountNumber: string;

  @Column({ name: 'verification_status', type: 'varchar' })
  verificationStatus: string;

  @Column({ name: 'is_primary', type: 'boolean' })
  isPrimary: boolean;
}
