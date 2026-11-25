import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import {
  configureHttpSurface,
  corsAllowList,
  corsOrigins,
  DEFAULT_CORS_ORIGINS,
  swaggerEnabled,
} from './http-surface';

@Controller('api/v1/probe')
class ProbeController {
  @Get()
  read() {
    return { data: 'ok' };
  }

  @Post()
  write(@Body() body: unknown) {
    return { data: body };
  }
}

type Settings = Record<string, string | undefined>;

// What the images and local runs set (Dockerfile, Dockerfile.dev, Dockerfile.prod).
const DEV_IMAGE: Settings = { NODE_ENV: 'production', ENV_FILE: '.env.dev' };
const PROD_IMAGE: Settings = { NODE_ENV: 'production', ENV_FILE: '.env.prod' };
const LOCAL: Settings = { NODE_ENV: 'development' };

async function startApp(settings: Settings) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  const result = configureHttpSurface(app, settings);
  await app.init();
  return { app, result };
}

describe('HTTP surface', () => {
  let app: NestExpressApplication | undefined;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.restoreAllMocks();
  });

  const start = async (settings: Settings) => {
    const started = await startApp(settings);
    app = started.app;
    return { http: request(app.getHttpServer()), ...started.result };
  };

  describe('CORS', () => {
    it.each([
      'https://pintarpintar.id',
      'https://www.pintarpintar.id',
      'https://dev.pintarpintar.id',
      'http://localhost:3000',
    ])('lets %s read responses in production', async (origin) => {
      const { http } = await start(PROD_IMAGE);
      const response = await http
        .get('/api/v1/probe')
        .set('Origin', origin)
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers.vary).toMatch(/Origin/);
      expect(response.headers['access-control-allow-credentials']).toBe(
        undefined,
      );
    });

    it.each([
      'https://evil.example',
      'https://pintarpintar.id.evil.example',
      'http://pintarpintar.id',
      'http://localhost:3030',
      'null',
    ])(
      'gives no CORS permission to %s in production, while the request itself still answers',
      async (origin) => {
        const { http } = await start(PROD_IMAGE);
        const response = await http
          .get('/api/v1/probe')
          .set('Origin', origin)
          .expect(200);
        expect(response.headers['access-control-allow-origin']).toBe(undefined);
        expect(response.headers.vary).toMatch(/Origin/);
      },
    );

    it('answers server-to-server calls without an Origin (Duitku callback, frontend server)', async () => {
      const { http } = await start(PROD_IMAGE);
      const response = await http
        .post('/api/v1/probe')
        .send({ a: 1 })
        .expect(201);
      expect(response.body).toEqual({ data: { a: 1 } });
      expect(response.headers['access-control-allow-origin']).toBe(undefined);
    });

    it('allows the preflight of an authorised JSON write from an allowed origin', async () => {
      const { http } = await start(PROD_IMAGE);
      const response = await http
        .options('/api/v1/probe')
        .set('Origin', 'https://pintarpintar.id')
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'https://pintarpintar.id',
      );
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET,HEAD,PUT,PATCH,POST,DELETE',
      );
      expect(response.headers['access-control-allow-headers']).toBe(
        'authorization,content-type',
      );
    });

    it('refuses the preflight from another origin', async () => {
      const { http } = await start(PROD_IMAGE);
      const response = await http
        .options('/api/v1/probe')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
      // Without Access-Control-Allow-Origin the browser blocks the request;
      // the other preflight headers grant nothing on their own.
      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(undefined);
    });

    it('allows any loopback port outside production, for local frontends', async () => {
      const { http } = await start(LOCAL);
      for (const origin of [
        'http://localhost:3030',
        'http://127.0.0.1:4100',
        'http://localhost',
      ]) {
        const response = await http.get('/api/v1/probe').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
      }
      for (const origin of [
        'http://localhost.evil.example',
        'https://evil.example',
        'http://localhost:3030.evil.example',
      ]) {
        const response = await http.get('/api/v1/probe').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBe(undefined);
      }
    });

    it('the development image allows the dev site but not other loopback ports', async () => {
      const { http } = await start(DEV_IMAGE);
      const dev = await http
        .get('/api/v1/probe')
        .set('Origin', 'https://dev.pintarpintar.id');
      expect(dev.headers['access-control-allow-origin']).toBe(
        'https://dev.pintarpintar.id',
      );
      const other = await http
        .get('/api/v1/probe')
        .set('Origin', 'http://localhost:3030');
      expect(other.headers['access-control-allow-origin']).toBe(undefined);
    });

    it('CORS_ORIGINS replaces the default list', async () => {
      const { http } = await start({
        ...PROD_IMAGE,
        CORS_ORIGINS: ' https://Staging.Example.org/ , http://localhost:3030 ',
      });
      for (const origin of [
        'https://staging.example.org',
        'http://localhost:3030',
      ]) {
        const response = await http.get('/api/v1/probe').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
      }
      const removed = await http
        .get('/api/v1/probe')
        .set('Origin', 'https://pintarpintar.id');
      expect(removed.headers['access-control-allow-origin']).toBe(undefined);
    });
  });

  describe('corsOrigins', () => {
    it('defaults to the production, www, dev and local frontend origins', () => {
      expect(DEFAULT_CORS_ORIGINS).toEqual([
        'https://pintarpintar.id',
        'https://www.pintarpintar.id',
        'https://dev.pintarpintar.id',
        'http://localhost:3000',
      ]);
      expect(corsOrigins({})).toEqual(DEFAULT_CORS_ORIGINS);
      expect(corsOrigins({ CORS_ORIGINS: '  ' })).toEqual(DEFAULT_CORS_ORIGINS);
    });

    it('normalises entries, drops duplicates and ignores invalid ones with a warning', () => {
      expect(
        corsOrigins({
          CORS_ORIGINS:
            'https://a.example:443,https://A.example/,*,https://a.example/path,ftp://b.example,http://b.example:8080',
        }),
      ).toEqual(['https://a.example', 'http://b.example:8080']);
      expect(warn).toHaveBeenCalledTimes(3);
      expect(warn.mock.calls.map(([message]) => message)).toEqual([
        expect.stringContaining('"*"'),
        expect.stringContaining('"https://a.example/path"'),
        expect.stringContaining('"ftp://b.example"'),
      ]);
    });

    it('logs an error when the setting has no valid origin, and allows none', () => {
      expect(corsOrigins({ CORS_ORIGINS: 'not a url' })).toEqual([]);
      expect(error).toHaveBeenCalledTimes(1);
      expect(corsAllowList({ ...PROD_IMAGE, CORS_ORIGINS: 'nope' })).toEqual(
        [],
      );
    });
  });

  describe('Swagger', () => {
    it.each([
      ['local run (NODE_ENV development)', LOCAL, true],
      ['local run without NODE_ENV', {}, true],
      ['development image', DEV_IMAGE, true],
      [
        'development image with a path to the file',
        { ...DEV_IMAGE, ENV_FILE: '/code/.env.dev' },
        true,
      ],
      ['production image', PROD_IMAGE, false],
      ['production without ENV_FILE', { NODE_ENV: 'production' }, false],
      [
        'production image with SWAGGER_ENABLED=true',
        { ...PROD_IMAGE, SWAGGER_ENABLED: ' TRUE ' },
        true,
      ],
      [
        'development image with SWAGGER_ENABLED=false',
        { ...DEV_IMAGE, SWAGGER_ENABLED: 'false' },
        false,
      ],
      [
        'local run with SWAGGER_ENABLED=false',
        { ...LOCAL, SWAGGER_ENABLED: 'false' },
        false,
      ],
    ])('%s: enabled is %p', (_name, settings, expected) => {
      expect(swaggerEnabled(settings as Settings)).toBe(expected);
    });

    it('an unknown SWAGGER_ENABLED value keeps the default and warns', () => {
      expect(swaggerEnabled({ ...PROD_IMAGE, SWAGGER_ENABLED: 'yes' })).toBe(
        false,
      );
      expect(swaggerEnabled({ ...DEV_IMAGE, SWAGGER_ENABLED: '1' })).toBe(true);
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('is not served by the production image', async () => {
      const { http, swagger } = await start(PROD_IMAGE);
      expect(swagger).toBe(false);
      await http.get('/api').expect(404);
      await http.get('/api/').expect(404);
      await http.get('/api-json').expect(404);
      await http.get('/api/swagger-ui-init.js').expect(404);
    });

    it('is served by the development image, with the API routes documented', async () => {
      const { http, swagger } = await start(DEV_IMAGE);
      expect(swagger).toBe(true);
      const json = await http.get('/api-json').expect(200);
      expect(json.body.info.title).toBe('Pintar Pintar API');
      expect(Object.keys(json.body.paths)).toContain('/api/v1/probe');
      const ui = await http.get('/api/').expect(200);
      expect(ui.headers['content-type']).toMatch(/text\/html/);
      const init = await http.get('/api/swagger-ui-init.js').expect(200);
      expect(init.headers['content-type']).toMatch(/javascript/);
      expect(init.headers['x-content-type-options']).toBe('nosniff');
    });

    it('SWAGGER_ENABLED=true serves it in production', async () => {
      const { http } = await start({ ...PROD_IMAGE, SWAGGER_ENABLED: 'true' });
      await http.get('/api-json').expect(200);
    });
  });

  describe('response headers', () => {
    it.each([
      ['a JSON answer', '/api/v1/probe', 200],
      ['a 404', '/api/v1/missing', 404],
    ])(
      '%s carries the security headers and no X-Powered-By',
      async (_name, path, status) => {
        const { http } = await start(PROD_IMAGE);
        const response = await http.get(path).expect(status);
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['x-powered-by']).toBe(undefined);
        expect(response.headers['content-security-policy']).toBe(undefined);
      },
    );

    it('a preflight carries them too', async () => {
      const { http } = await start(PROD_IMAGE);
      const response = await http
        .options('/api/v1/probe')
        .set('Origin', 'https://pintarpintar.id')
        .set('Access-Control-Request-Method', 'POST');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBe(undefined);
    });
  });
});
