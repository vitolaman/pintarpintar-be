import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { Product } from '../profile/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), CatalogModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
