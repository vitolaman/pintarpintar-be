import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule, utilities as WinstonNestUtilities } from 'nest-winston';
import * as Winston from 'winston';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ErrorResponseDto } from './common/dto/error-response.dto';
import { CustomHttpExceptionFilter } from './common/filters/exception-error.filter';
import { documentErrorResponses } from './common/swagger/error-responses';

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
      // An unknown field (a typo or an old name) is a 400 naming it, not
      // silently ignored.
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new CustomHttpExceptionFilter());
  // Responses carry image URLs only; without the base URL every image is null.
  if (!process.env.ASSET_PUBLIC_BASE_URL) {
    new Logger('Bootstrap').error(
      'ASSET_PUBLIC_BASE_URL is not set: every image URL in the responses will be null',
    );
  }
  app.enableCors({ origin: '*' });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Pintar Pintar API')
      .setDescription('Pintar Pintar backend API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
    { extraModels: [ErrorResponseDto] },
  );
  documentErrorResponses(app, document);

  SwaggerModule.setup('api', app, document);
  await app.listen(3001, () => {
    console.log('[REST]', `http://localhost:3001/api`);
  });
}
bootstrap();
