import { Module } from '@nestjs/common';
import { MasterPfpService } from './master-pfp.service';
import { MasterPfpController } from './master-pfp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterProfilePicture } from './entities/master-pfp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MasterProfilePicture])],
  controllers: [MasterPfpController],
  providers: [MasterPfpService],
})
export class MasterPfpModule {}
