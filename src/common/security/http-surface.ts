import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { basename } from 'path';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { documentErrorResponses } from '../swagger/error-responses';

type Settings = Record<string, string | undefined>;

/** Browser origins that may call the API unless CORS_ORIGINS replaces them. */
export const DEFAULT_CORS_ORIGINS: readonly string[] = [
  'https://pintarpintar.id',
  'https://www.pintarpintar.id',
  'https://dev.pintarpintar.id',
  'http://localhost:3000',
];

/** Any port on a loopback host, for frontends started locally on another port. */
export const LOOPBACK_ORIGIN =
  /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

/** The settings file the development image carries (Dockerfile, Dockerfile.dev). */
const DEVELOPMENT_SETTINGS_FILE = '.env.dev';

const logger = new Logger('HttpSurface');

function isProduction(settings: Settings): boolean {
  return settings.NODE_ENV?.trim() === 'production';
}

/**
 * Origins allowed to read API responses in a browser: CORS_ORIGINS
 * (comma-separated) or the defaults. An entry that is not a bare http(s)
 * origin is ignored with a warning; origins are public, so the entry is named.
 */
export function corsOrigins(settings: Settings): string[] {
  const configured = settings.CORS_ORIGINS?.trim() ?? '';
  if (!configured) return [...DEFAULT_CORS_ORIGINS];
  const origins: string[] = [];
  for (const entry of configured.split(',').map((value) => value.trim())) {
    if (!entry) continue;
    const origin = toOrigin(entry);
    if (origin) {
      origins.push(origin);
    } else {
      logger.warn(
        `CORS_ORIGINS entry "${entry}" is not an http(s) origin; ignored`,
      );
    }
  }
  if (origins.length === 0) {
    logger.error(
      'CORS_ORIGINS has no valid origin: browsers on other sites cannot call the API',
    );
  }
  return [...new Set(origins)];
}

function toOrigin(entry: string): string | null {
  try {
    const url = new URL(entry);
    const bare =
      url.pathname === '/' && !url.search && !url.hash && !url.username;
    if (!bare || !['http:', 'https:'].includes(url.protocol)) return null;
    // URL lower-cases the host and drops a default port, as browsers send Origin.
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The allow-list for the `cors` middleware. Outside production (local runs)
 * any loopback origin is allowed too. No credentials: the API authenticates
 * with a bearer token, never cookies.
 */
export function corsAllowList(settings: Settings): (string | RegExp)[] {
  const origins: (string | RegExp)[] = corsOrigins(settings);
  if (!isProduction(settings)) origins.push(LOOPBACK_ORIGIN);
  return origins;
}

/**
 * Swagger UI (`/api`) and JSON (`/api-json`) are served unless the app runs in
 * production with a settings file other than the development one. Both
 * images set NODE_ENV=production; only the development image loads
 * `.env.dev`, so dev and local runs keep Swagger with no setting.
 * SWAGGER_ENABLED=true or false overrides that.
 */
export function swaggerEnabled(settings: Settings): boolean {
  const override = settings.SWAGGER_ENABLED?.trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  if (override) {
    logger.warn(
      'SWAGGER_ENABLED is neither true nor false; the default applies',
    );
  }
  if (!isProduction(settings)) return true;
  const envFile = settings.ENV_FILE?.trim();
  return Boolean(envFile) && basename(envFile) === DEVELOPMENT_SETTINGS_FILE;
}

/** Headers for every response; the API serves JSON, Swagger UI and email images. */
export function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

/**
 * Applies the HTTP rules every response follows: no framework banner,
 * security headers, the CORS allow-list and, when enabled, Swagger. Call it
 * before the app starts listening.
 */
export function configureHttpSurface(
  app: NestExpressApplication,
  settings: Settings = process.env,
): { swagger: boolean } {
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.enableCors({ origin: corsAllowList(settings), credentials: false });

  const swagger = swaggerEnabled(settings);
  if (swagger) {
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
  } else {
    logger.log('Swagger is off (SWAGGER_ENABLED=true turns it on)');
  }
  return { swagger };
}
