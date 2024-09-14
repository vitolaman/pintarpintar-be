import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'weekly_leaderboard_category' })
export class WeeklyLeaderboardCategory extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'counter', nullable: false })
  counter: number;

  @ApiProperty()
  @Column({ name: 'name', nullable: false })
  name: string;

  @ApiProperty({ description: 'The starting date for the leaderboard period' })
  @Column({ name: 'from_date', type: 'timestamp', nullable: false })
  fromDate: Date;

  @ApiProperty({ description: 'The ending date for the leaderboard period' })
  @Column({ name: 'to_date', type: 'timestamp', nullable: false })
  toDate: Date;
}
