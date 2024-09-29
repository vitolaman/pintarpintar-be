import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'master_tasks' })
export class Task extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'task_name', nullable: false })
  name: string;

  @ApiProperty()
  @Column({ nullable: false })
  url: string;

  @ApiProperty()
  @Column({ nullable: false })
  type: string;

  @ApiProperty()
  @Column({ nullable: false, default: 1 })
  token: number; // Dikacang kalau di task login karena dinamis, pakai login_streak_metadata

  @ApiProperty()
  @Column({ nullable: false, default: false })
  isRepeatable: boolean;

  @ApiProperty()
  @Column({ nullable: false, default: false })
  isUnlimited: boolean;

  @ApiProperty()
  @Column({ name: 'max_repeat', nullable: true })
  maxRepeat: number;

  @ApiProperty()
  @Column({ nullable: false, default: 1 })
  repeatableType: number; // 0: none, 1: daily

  @ApiProperty({
    type: [Number],
    example: [10, 20, 30, 40, 50],
    description: 'Points earned at each streak milestone',
  })
  @Column('integer', {
    name: 'login_streak_metadata',
    array: true,
    nullable: true,
  })
  loginStreakMetadata: number[];
}
