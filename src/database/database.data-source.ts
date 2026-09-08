import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseLogger } from './database.logger';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { User } from '~/api/user/entities/user.entity';
import { FileAsset } from '~/api/profile/entities/file-asset.entity';
import { IssuedCertificate } from '~/api/profile/entities/issued-certificate.entity';
import { Product } from '~/api/profile/entities/product.entity';
import { Profile } from '~/api/profile/entities/profile.entity';
import { StudentProgress } from '~/api/profile/entities/student-progress.entity';
import { UserAccess } from '~/api/profile/entities/user-access.entity';
import { MerchantMember } from '~/api/merchant/entities/merchant-member.entity';
import { MerchantProfile } from '~/api/merchant/entities/merchant-profile.entity';
import { Merchant } from '~/api/merchant/entities/merchant.entity';
import { UserNotificationPreferences } from '~/api/merchant/entities/user-notification-preferences.entity';
import { Mentor } from '~/api/mentor/entities/mentor.entity';
import { MentorProfile } from '~/api/mentor/entities/mentor-profile.entity';

dotenvExpand.expand(dotenv.config({ path: process.env.ENV_FILE || '.env' }));
const isProduction = process.env.NODE_ENV == 'production';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [
    FileAsset,
    IssuedCertificate,
    Merchant,
    MerchantMember,
    MerchantProfile,
    Mentor,
    MentorProfile,
    Product,
    Profile,
    StudentProgress,
    User,
    UserAccess,
    UserNotificationPreferences,
  ],
  // Pintar Pintar starts from its own ERD baseline. Legacy template migrations
  // remain in `migrations/` as reference only and must never run on this database.
  migrations: [`${__dirname}/migrations/pintar-pintar/*.{js,ts}`],
  synchronize: false,
  migrationsRun: true,
  migrationsTransactionMode: 'each',
  logging: true,
  logger: isProduction
    ? new DatabaseLogger(new Logger('Database'), true)
    : 'advanced-console',
};

export const defaultDataSource = new DataSource(dataSourceOptions);
