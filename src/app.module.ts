import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { defaultDataSource } from './database/database.data-source';
import { MasterCountryModule } from './api/master-country/master-country.module';

@Module({
  imports: [TypeOrmModule.forRoot(defaultDataSource), MasterCountryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
