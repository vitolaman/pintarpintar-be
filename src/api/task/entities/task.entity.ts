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
  token: number;

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
}
