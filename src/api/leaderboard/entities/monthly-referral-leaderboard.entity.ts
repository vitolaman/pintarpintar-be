import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'monthly_referral_leaderboard' })
export class MonthlyReferralLeaderboard extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId: string;

  @ApiProperty()
  @Column({ name: 'sum_point', nullable: false })
  sumPoint: number;
}
