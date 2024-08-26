import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'weekly_prediction_leaderboard' })
export class WeeklyPredictionLeaderboard extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ApiProperty()
  @Column({ name: 'sum_point', nullable: false })
  sumPoint: number;
}
