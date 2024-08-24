import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseLogger } from './database.logger';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';

dotenvExpand.expand(dotenv.config());
const isProduction = process.env.NODE_ENV == 'production';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [`${__dirname}/../**/*.entity.{js,ts}`],
  migrations: [`${__dirname}/migrations/*.{js,ts}`],
  synchronize: false,
  migrationsRun: true,
  migrationsTransactionMode: 'each',
  logging: true,
  logger: isProduction
    ? new DatabaseLogger(new Logger('Database'), true)
    : 'advanced-console',
};

export const defaultDataSource = new DataSource(dataSourceOptions);
