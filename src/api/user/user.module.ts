import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserMeController } from './user-me.controller';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Referrals } from './entities/referrals.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Referrals])],
  controllers: [UserMeController, UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
