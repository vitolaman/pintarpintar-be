import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'monthly_referral_leaderboard' })
export class MonthlyReferralLeaderboard extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ApiProperty()
  @Column({ name: 'sum_point', nullable: false })
  sumPoint: number;

  @ApiProperty({ description: 'The starting date for the leaderboard period' })
  @Column({ name: 'from_date', type: 'timestamp', nullable: false })
  fromDate: Date;

  @ApiProperty({ description: 'The ending date for the leaderboard period' })
  @Column({ name: 'to_date', type: 'timestamp', nullable: false })
  toDate: Date;
}
