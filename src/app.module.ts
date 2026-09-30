import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './api/auth/auth.module';
import { User } from './api/user/entities/user.entity';
import { UserModule } from './api/user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtGuard } from './common/guard/jwt.guard';
// import { RedisModule } from './common/redis/src';
// import { RedisHealthIndicator } from './common/redis/src/redis-health-indicator';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import jwtConfig from './config/jwt.config';
import adminJwtConfig from './config/admin-jwt.config';
import redisConfig from './config/redis.config';
import twitterRapidapiConfig from './config/twitter-rapidapi.config';
import { dataSourceOptions } from './database/database.data-source';
import { ProfileModule } from './api/profile/profile.module';
import { HomeModule } from './api/home/home.module';
import { MerchantModule } from './api/merchant/merchant.module';
import { MentorModule } from './api/mentor/mentor.module';
import { UploadModule } from './upload/upload.module';
import { ClassModule } from './class/class.module';
import { VoucherModule } from './api/voucher/voucher.module';
import { HelpTicketModule } from './api/help-ticket/help-ticket.module';
import { PortalModule } from './api/portal/portal.module';
import { OrderModule } from './api/order/order.module';
import { PayoutAccountModule } from './api/payout-account/payout-account.module';
import { BundleModule } from './api/bundle/bundle.module';
import { DiscountModule } from './api/discount/discount.module';
import { MerchantDashboardModule } from './api/merchant-dashboard/merchant-dashboard.module';
import { FileAssetModule } from './api/file-asset/file-asset.module';
import { WishlistModule } from './api/wishlist/wishlist.module';
import { CartModule } from './api/cart/cart.module';
import { FaqModule } from './api/faq/faq.module';
import { CatalogModule } from './api/catalog/catalog.module';
import { ReviewModule } from './api/review/review.module';
import { PromoModule } from './api/promo/promo.module';
import { DiscussionModule } from './api/discussion/discussion.module';
import { DigitalProductModule } from './api/digital-product/digital-product.module';
import { LearningModule } from './api/learning/learning.module';
import { PaymentModule } from './api/payment/payment.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'profile_pics'),
      serveRoot: '/profile-pictures',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'master_profile_pics'),
      serveRoot: '/master-profile-pictures',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.ENV_FILE || '.env',
      load: [redisConfig, jwtConfig, twitterRapidapiConfig, adminJwtConfig],
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([User]),
    // Limits are set per route with @Throttle; no guard applies globally.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    ScheduleModule.forRoot(),
    // RedisModule,
    AuthModule,
    ClassModule,
    UserModule,
    ProfileModule,
    HomeModule,
    MerchantModule,
    MentorModule,
    UploadModule,
    VoucherModule,
    HelpTicketModule,
    PortalModule,
    OrderModule,
    PayoutAccountModule,
    BundleModule,
    DiscountModule,
    MerchantDashboardModule,
    FileAssetModule,
    WishlistModule,
    CartModule,
    FaqModule,
    CatalogModule,
    ReviewModule,
    PromoModule,
    DiscussionModule,
    DigitalProductModule,
    LearningModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    // RedisHealthIndicator,
    AppService,
  ],
})
export class AppModule {}
