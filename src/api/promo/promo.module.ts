import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { VoucherModule } from '../voucher/voucher.module';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';

@Module({
  imports: [CatalogModule, VoucherModule],
  controllers: [PromoController],
  providers: [PromoService],
})
export class PromoModule {}
