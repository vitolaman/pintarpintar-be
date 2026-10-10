import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { CertificationPartnershipRequest } from './entities/certification-partnership-request.entity';
import { PartnershipRequestController } from './partnership-request.controller';
import { PartnershipRequestService } from './partnership-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([CertificationPartnershipRequest, User])],
  controllers: [PartnershipRequestController],
  providers: [PartnershipRequestService],
})
export class PartnershipRequestModule {}
