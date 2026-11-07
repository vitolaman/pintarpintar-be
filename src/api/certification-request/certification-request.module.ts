import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { CertificationRequest } from './entities/certification-request.entity';
import { CertificationRequestController } from './certification-request.controller';
import { CertificationRequestService } from './certification-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([CertificationRequest, User])],
  controllers: [CertificationRequestController],
  providers: [CertificationRequestService],
})
export class CertificationRequestModule {}
