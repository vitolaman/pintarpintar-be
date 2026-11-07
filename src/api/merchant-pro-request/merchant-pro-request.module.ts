import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { MerchantProRequest } from './entities/merchant-pro-request.entity';
import { MerchantProRequestController } from './merchant-pro-request.controller';
import { MerchantProRequestService } from './merchant-pro-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([MerchantProRequest, User])],
  controllers: [MerchantProRequestController],
  providers: [MerchantProRequestService],
})
export class MerchantProRequestModule {}
