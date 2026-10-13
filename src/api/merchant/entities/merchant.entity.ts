import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import {
  DEFAULT_PLATFORM_FEE_PAYER,
  PlatformFeePayer,
} from '~/common/pricing/platform-fee';

export enum MerchantStorageLevel {
  BASIC = 'basic',
  SILVER = 'silver',
  GOLD = 'gold',
}

@Entity({ name: 'merchants' })
export class Merchant extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'store_name' })
  storeName: string;

  @Column({ name: 'store_description', type: 'text', nullable: true })
  storeDescription: string | null;

  @Column({
    name: 'storage_level',
    type: 'enum',
    enum: MerchantStorageLevel,
    enumName: 'merchant_storage_level_enum',
    default: MerchantStorageLevel.BASIC,
  })
  storageLevel: MerchantStorageLevel;

  @Column()
  status: string;

  // When the monthly level evaluation started counting for this merchant:
  // registration, or the deploy of the level rules for older merchants.
  @Column({
    name: 'level_tracked_from',
    type: 'timestamp',
    default: () => 'now()',
  })
  levelTrackedFrom: Date;

  // Who pays the platform fee of this merchant's sales; constrained by
  // `chk_merchants_platform_fee_paid_by`.
  @Column({
    name: 'platform_fee_paid_by',
    type: 'varchar',
    length: 8,
    default: DEFAULT_PLATFORM_FEE_PAYER,
  })
  platformFeePaidBy: PlatformFeePayer;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;
}
