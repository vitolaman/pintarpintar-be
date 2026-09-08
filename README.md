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
- `GET /merchants/v1/get-my-merchant`
- `PATCH /merchants/v1/update-my-merchant`
- `GET /merchants/v1/get-notification-preferences`
- `PATCH /merchants/v1/update-notification-preferences`

### Mentor

- `POST /mentors/v1/sign-up`
- `POST /mentors/v1/register`
- `GET /mentors/v1/get-mentor/:id`
- `GET /mentors/v1/get-profile`
- `PATCH /mentors/v1/update-profile`
- `GET /mentors/v1/get-assignments`

### Home

- `GET /home/v1/get-statistics`
- `GET /home/v1/get-bootcamps`
- `GET /home/v1/get-video-classes`
- `GET /home/v1/get-digital-products`
- `GET /home/v1/get-merchants`
- `GET /home/v1/get-testimonials`

## Swagger

```bash
http://localhost:3000/api
```

## Create Migration

```bash
$ npx typeorm migration:generate {{name}} -d dist/database/database.data-source.js
```

Then copy the migration file to `src/database/migrations`.

## License

Nest is [MIT licensed](LICENSE).
