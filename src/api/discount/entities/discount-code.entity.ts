import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// Follows the merchant discount page: `once` ("Kode Sekali Pakai") is a
// single-use code (usage limit 1), and an entry of N generates N of them;
// `recurring` ("Kode Berulang") is one shared code usable `usage_limit` times.
export const discountCodeTypes = ['once', 'recurring'] as const;

export type DiscountCodeType = (typeof discountCodeTypes)[number];

@Entity({ name: 'discount_codes' })
export class DiscountCode extends BaseEntity {
  @Column({ name: 'discount_id', type: 'uuid' })
  discountId: string;

  @Column({ type: 'varchar', length: 32 })
  code: string;

  @Column({ name: 'code_type', type: 'varchar' })
  codeType: DiscountCodeType;

  @Column({ name: 'usage_limit', type: 'integer' })
  usageLimit: number;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount: number;
}
