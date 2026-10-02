import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

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

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;
}
