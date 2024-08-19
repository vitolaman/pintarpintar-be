import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { defaultDataSource } from './database/database.data-source';

@Module({
  imports: [TypeOrmModule.forRoot(defaultDataSource)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
