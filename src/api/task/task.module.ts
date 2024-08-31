import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task-master.controller';
import { Task } from './entities/task.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskHistory } from './entities/task-histories.entity';
import { TaskUserController } from './task-user.controller';
import { TaskUserService } from './task-user.service';
import { User } from '../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '~/common/util/http.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskHistory, User])],
  controllers: [TaskController, TaskUserController],
  providers: [TaskService, TaskUserService, HttpService, ConfigService],
})
export class TaskModule {}
