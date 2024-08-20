import { Module } from '@nestjs/common';
import { MasterCountryService } from './master-country.service';
import { MasterCountryController } from './master-country.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterCountry } from './entities/master-country.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MasterCountry])],
  controllers: [MasterCountryController],
  providers: [MasterCountryService],
})
export class MasterCountryModule {}
