import './tracing';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { WinstonModule, utilities as WinstonNestUtilities } from 'nest-winston';
import * as Winston from 'winston';
import { Logger, ValidationPipe } from '@nestjs/common';
import { CustomHttpExceptionFilter } from './common/filters/exception-error.filter';
import { configureHttpSurface } from './common/security/http-surface';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new Winston.transports.Console({
          format: Winston.format.combine(
            Winston.format.timestamp(),
            Winston.format.ms(),
            WinstonNestUtilities.format.nestLike('API', {
              colors: true,
              prettyPrint: false,
            }),
          ),
        }),
      ],
    }),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // An unknown field (a typo or an old name) is a 400 naming it, not
      // silently ignored.
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(
    new CustomHttpExceptionFilter({
      sanitizeDatabaseErrors: process.env.NODE_ENV === 'production',
    }),
  );
  // Responses carry image URLs only; without the base URL every image is null.
  if (!process.env.ASSET_PUBLIC_BASE_URL) {
    new Logger('Bootstrap').error(
      'ASSET_PUBLIC_BASE_URL is not set: every image URL in the responses will be null',
    );
  }
  configureHttpSurface(app);
  await app.listen(3001, () => {
    console.log('[REST]', `http://localhost:3001/api`);
  });
}
bootstrap();
