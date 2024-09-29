import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task-master.controller';
import { Task } from './entities/task.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskHistory } from './entities/task-histories.entity';
import { TaskUserController } from './task-user.controller';
import { TaskUserService } from './task-user.service';
import { User } from '../user/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpService } from '~/common/util/http.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskHistory, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('ADMIN_JWT_ADMIN_KEY'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES') },
      }),
    }),
  ],
  controllers: [TaskController, TaskUserController],
  providers: [TaskService, TaskUserService, HttpService, ConfigService],
})
export class TaskModule {}
