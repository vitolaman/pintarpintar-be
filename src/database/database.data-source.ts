import { Logger } from '@nestjs/common';
import { DataSourceOptions } from 'typeorm';
import { DatabaseLogger } from './database.logger';
// import { dbConstants } from '~/constant/db.constant';

const isProduction = process.env.NODE_ENV == 'production';

export const defaultDataSource: DataSourceOptions = {
  type: 'postgres',
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  username: 'postgres.afkbqpnktoyfaejbhxcl',
  password: 'Scora123!#@',
  database: 'postgres',
  entities: [`${__dirname}/../**/*.entity.{js,ts}`],
  migrations: [`${__dirname}/migrations/*.{js,ts}`],
  synchronize: true,
  migrationsRun: true,
  migrationsTransactionMode: 'each',
  logging: true,
  logger: isProduction
    ? new DatabaseLogger(new Logger('Database'), true)
    : 'advanced-console',
};
