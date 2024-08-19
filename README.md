## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm i -g @nest/cli
$ npm install
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Create Migration
```bash
$ npx typeorm migration:generate {{name}} -d dist/database/database.data-source.js
```
Then Copy the migration file to src/database/migrations

## License

Nest is [MIT licensed](LICENSE).
