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

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;
}
