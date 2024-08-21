import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserMeController } from './user-me.controller';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RedisService } from '~/common/redis/src';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserMeController, UserController],
  providers: [UserService, RedisService],
  exports: [UserService],
})
export class UserModule {}
