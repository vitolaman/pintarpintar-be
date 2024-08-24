import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task-master.controller';
import { Task } from './entities/task.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskHistory } from './entities/task-histories.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskHistory])],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
