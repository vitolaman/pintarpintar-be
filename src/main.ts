import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule, utilities as WinstonNestUtilities } from 'nest-winston';
import * as Winston from 'winston';
import { ValidationPipe } from '@nestjs/common';
import { CustomHttpExceptionFilter } from './common/filters/exception-error.filter';
import { CronJobModule } from './api/cron-job/cron-job.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configModule = await NestFactory.createApplicationContext(
    ConfigModule.forRoot(),
  );
  const configService = configModule.get(ConfigService);

  const getAppName = (name: string) => {
    switch (name) {
      case 'leaderboard-cron':
        return CronJobModule;
      default:
        return AppModule;
    }
  };

  const appConfig = configService.get<string>('BOT_NAME');
  const appName = getAppName(appConfig);

  const app = await NestFactory.create(appName, {
    cors: true,
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

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new CustomHttpExceptionFilter());
  app.enableCors({ origin: '*' });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SCORA API')
      .setDescription(
        ['API Documentation', 'https://github.com/vitolaman/'].join('<br>'),
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup('api', app, document);
  await app.listen(3000, () => {
    console.log(
      `[${appConfig ? 'CRON' : 'REST'}]`,
      `http://localhost:3000/api`,
    );
  });
}
bootstrap();
