import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { MerchantRegistrationRequest } from './entities/merchant-registration-request.entity';
import { MerchantRegistrationRequestController } from './merchant-registration-request.controller';
import { MerchantRegistrationRequestService } from './merchant-registration-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([MerchantRegistrationRequest, User])],
  controllers: [MerchantRegistrationRequestController],
  providers: [MerchantRegistrationRequestService],
})
export class MerchantRegistrationRequestModule {}
