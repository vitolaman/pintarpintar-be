import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '~/api/user/entities/user.entity';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'monthly_prediction_leaderboard' })
export class MonthlyPredictionLeaderboard extends BaseEntity {
  @ApiProperty()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;
  @Column({ type: 'text' })
  userId: string;

  @ApiProperty()
  @Column({ name: 'sum_point', nullable: false })
  sumPoint: number;
}
