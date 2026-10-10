import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from '../payment/payment.module';
import { VoucherModule } from '../voucher/voucher.module';
import { CheckoutQuoteService } from './checkout/checkout-quote.service';
import { CheckoutService } from './checkout/checkout.service';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    PaymentModule,
    VoucherModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, CheckoutQuoteService, CheckoutService],
  exports: [TypeOrmModule],
})
export class OrderModule {}
