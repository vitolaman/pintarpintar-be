import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A merchant's mentor list entry (existing `merchant_mentors` table).
@Entity({ name: 'merchant_mentors' })
export class MerchantMentor extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'mentor_user_id', type: 'uuid' })
  mentorUserId: string;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ name: 'joined_at', type: 'timestamp', nullable: true })
  joinedAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;
}
