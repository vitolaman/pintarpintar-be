import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule, utilities as WinstonNestUtilities } from 'nest-winston';
import * as Winston from 'winston';
import { ValidationPipe } from '@nestjs/common';
import { CustomHttpExceptionFilter } from './common/filters/exception-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
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

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new CustomHttpExceptionFilter());
  app.enableCors({ origin: '*' });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Pintar Pintar API')
      .setDescription('Pintar Pintar backend API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup('api', app, document);
  await app.listen(3000, () => {
    console.log('[REST]', `http://localhost:3000/api`);
  });
}
bootstrap();
