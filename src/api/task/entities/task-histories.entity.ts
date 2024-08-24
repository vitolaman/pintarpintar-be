import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '~/api/user/entities/user.entity';
import { BaseEntity } from '~/common/entities/base-entity';
import { Task } from './task.entity';

@Entity({ name: 'tasks_histories' })
export class TaskHistory extends BaseEntity {
  @ApiProperty()
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;
  @Column({ type: 'text' })
  userId: string;

  @ApiProperty()
  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id', referencedColumnName: 'id' })
  task: Task;
  @Column({ type: 'text' })
  taskId: string;
}
