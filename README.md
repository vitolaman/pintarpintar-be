# Pintar Pintar Backend

Backend API for Pintar Pintar.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm i -g @nest/cli
$ cp .env.example .env
$ yarn install
```

## Running the app

```bash
# development
$ yarn start

# local development
$ yarn start:local

# local database
$ yarn db:local:up
$ yarn db:local:migrate
```

## API

### Authentication

- `POST /auth/sign-up`
- `POST /auth/sign-in`

### User

- `GET /users/me`
- `PATCH /users/me`
- `DELETE /users/me`

### Profile

- `GET /profile/v1/get-profile`
- `PATCH /profile/v1/update-profile`
- `GET /profile/v1/get-learning`
- `GET /profile/v1/get-certifications`

### Merchant

- `POST /merchants/v1/register`
- `GET /merchants/v1/get-public-merchant/:slug`
- `GET /merchants/v1/get-profile`
- `PATCH /merchants/v1/update-profile`
- `GET /merchants/v1/get-notification-preferences`
- `PATCH /merchants/v1/update-notification-preferences`

### Mentor

- `POST /mentors/v1/sign-up`
- `POST /mentors/v1/register`
- `GET /mentors/v1/get-mentor/:id`
- `GET /mentors/v1/get-profile`
- `PATCH /mentors/v1/update-profile`
- `GET /mentors/v1/get-assignments`

### Voucher

- `POST /vouchers/v1/create-voucher`
- `GET /vouchers/v1/get-vouchers`
- `GET /vouchers/v1/get-voucher/:id`
- `PATCH /vouchers/v1/update-voucher/:id`
- `DELETE /vouchers/v1/delete-voucher/:id`
- `GET /vouchers/v1/get-public-vouchers`
- `GET /vouchers/v1/get-featured-vouchers`

### Home

- `GET /home/v1/get-statistics`
- `GET /home/v1/get-bootcamps`
- `GET /home/v1/get-video-classes`
- `GET /home/v1/get-digital-products`
- `GET /home/v1/get-merchants`
- `GET /home/v1/get-testimonials`

### Help Tickets

- `POST /help-tickets/v1/create-help-ticket`
- `GET /help-tickets/v1/get-help-tickets`
- `GET /help-tickets/v1/get-help-ticket/:id`

## Swagger

```bash
http://localhost:3001/api
```

## Observability (OpenTelemetry + Jaeger)

Tracing is initialized in [src/tracing.ts](src/tracing.ts) and loaded before Nest bootstrap from [src/main.ts](src/main.ts).

1. Start local dependencies and Jaeger:

```bash
$ docker compose --env-file .env.local up -d postgres redis jaeger
```

2. Make sure your env points to Jaeger's OTLP HTTP endpoint:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=pintar-pintar-be
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318/v1/traces
```

3. Run API and open Jaeger UI:

```bash
$ yarn start:local
# http://localhost:16686
```

4. Hit any API endpoint (for example from Swagger), then search traces in Jaeger with service `pintar-pintar-be`.

## Required checks before pushing

Run both commands on the merged state of `development` before pushing. `npm test` alone is not sufficient: it does not compile files that no spec imports, so build-only errors can pass tests and fail on `npm run build`.

```bash
$ npm run build
$ npm test
```

Database schema changes require a reviewed TypeORM migration in `src/database/migrations/pintar-pintar/`. Do not rely on entity-level synchronization (`synchronize`) to alter the schema; shared databases are managed by migrations only.

## Create Migration

```bash
$ npx typeorm migration:generate {{name}} -d dist/database/database.data-source.js
```

Then copy the migration file to `src/database/migrations`.

## License

Nest is [MIT licensed](LICENSE).
