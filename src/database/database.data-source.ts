import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseLogger } from './database.logger';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { User } from '~/api/user/entities/user.entity';

dotenvExpand.expand(dotenv.config({ path: process.env.ENV_FILE || '.env' }));
const isProduction = process.env.NODE_ENV == 'production';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User],
  // Pintar Pintar starts from its own ERD baseline. Legacy template migrations
  // remain in `migrations/` as reference only and must never run on this database.
  migrations: [`${__dirname}/migrations/pintar-pintar/*.{js,ts}`],
  synchronize: false,
  migrationsRun: false,
  migrationsTransactionMode: 'each',
  // PostgreSQL extensions are created by the first ERD migration, never by app startup.
  installExtensions: false,
  logging: true,
  logger: isProduction
    ? new DatabaseLogger(new Logger('Database'), true)
    : 'advanced-console',
};

export const defaultDataSource = new DataSource(dataSourceOptions);
