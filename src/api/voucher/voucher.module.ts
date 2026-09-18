import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../profile/entities/product.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { MerchantProfile } from '../merchant/entities/merchant-profile.entity';
import { VoucherService } from './voucher.service';
import { VoucherController } from './voucher.controller';
import { CouponProductScope } from './entities/coupon-product-scope.entity';
import { Voucher } from './entities/voucher.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CouponProductScope,
      Merchant,
      MerchantProfile,
      Product,
      Voucher,
    ]),
  ],
  controllers: [VoucherController],
  providers: [VoucherService],
})
export class VoucherModule {}
