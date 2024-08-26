import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'yearly_leaderboard' })
export class YearlyLeaderboard extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ApiProperty()
  @Column({ name: 'sum_point', nullable: false })
  sumPoint: number;

  @ApiProperty()
  @Column({ name: 'type', nullable: false })
  type: number; // 1: Prediction; 2: Referral
}
