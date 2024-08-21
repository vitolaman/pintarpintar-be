import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { defaultDataSource } from './database/database.data-source';
import { MasterCountryModule } from './api/master-country/master-country.module';
import { ConfigModule } from '@nestjs/config';
import { getEnvPath } from './common/helper/env.helper';
import { AuthModule } from './api/auth/auth.module';
import { UserModule } from './api/user/user.module';

const envFilePath: string = getEnvPath(`${__dirname}/common/helper`);

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath, isGlobal: true }),
    TypeOrmModule.forRoot(defaultDataSource),
    MasterCountryModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
