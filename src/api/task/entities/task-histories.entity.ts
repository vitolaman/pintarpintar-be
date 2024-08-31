import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'tasks_histories' })
export class TaskHistory extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ApiProperty()
  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string;
}
