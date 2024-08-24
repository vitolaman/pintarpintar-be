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
}
