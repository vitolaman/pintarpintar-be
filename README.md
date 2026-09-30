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

Every route requires a Bearer token except those marked **public**. The full request and response schemas are in Swagger (below).

### Authentication and user

- `POST /auth/sign-up` — **public**
- `POST /auth/sign-in` — **public**
- `GET /users/me`
- `PATCH /users/me`
- `DELETE /users/me`

### Beranda (home)

- `GET /home/v1/get-statistics` — **public**; active learners, published classes and digital products, platform rating
- `GET /home/v1/get-bootcamps` — **public**
- `GET /home/v1/get-video-classes` — **public**
- `GET /home/v1/get-digital-products` — **public**
- `GET /home/v1/get-merchants` — **public**
- `GET /home/v1/get-testimonials` — **public**; well-rated class reviews

### Catalog (Kelas, Bootcamp, Produk Digital)

- `GET /catalog/v1/get-items` — **public**; filter by type, search, level, category, merchant (`merchant_id`), and digital file type (`file_format`); sort; paginate
- `GET /catalog/v1/get-class/:id` — **public**; syllabus, mentors, and meeting schedule, without video, file, or meeting links
- `GET /catalog/v1/get-digital-product/:id` — **public**; file formats and sizes, without download links

### Promo

- `GET /promo/v1/get-promo-items` — **public**; random discounted classes (`type=kelas`) or digital products (`type=digital`), up to 6
- `GET /promo/v1/get-promo-vouchers` — **public**; `featured` (3) and `vouchers` (up to 6) from one random draw, without overlap while enough vouchers exist

### Vouchers

- `GET /vouchers/v1/get-public-vouchers` — **public**; search, category, and merchant (`merchant_slug` or `merchant_id`) filters
- `GET /vouchers/v1/get-featured-vouchers` — **public**; 3 random vouchers with tags
- `POST /vouchers/v1/create-voucher` — merchant
- `GET /vouchers/v1/get-vouchers` — merchant
- `GET /vouchers/v1/get-voucher/:id` — merchant
- `PATCH /vouchers/v1/update-voucher/:id` — merchant
- `DELETE /vouchers/v1/delete-voucher/:id` — merchant

### Class reviews

- `POST /reviews/v1/create-review` — enrolled learners only, one review per class
- `GET /reviews/v1/get-class-reviews/:classId` — **public**; average, count, and paged reviews
- `GET /reviews/v1/get-merchant-reviews/:merchantId` — **public**; reviews of a merchant's classes and products (Review tab)

### Pusat Bantuan

- `GET /faqs/v1/get-public-faqs` — **public**
- `POST /help-tickets/v1/create-help-ticket`
- `GET /help-tickets/v1/get-help-tickets`
- `GET /help-tickets/v1/get-help-ticket/:id`

### Profile and Portal Saya

- `GET /profile/v1/get-profile` — includes `member_since`
- `PATCH /profile/v1/update-profile`
- `GET /profile/v1/get-learning`
- `GET /profile/v1/get-certifications` — issued class certificates with the class mentor
- `GET /profile/v1/get-statistics` — bootcamps, video classes, digital products, and certificates (Statistik Pembelajaran)
- `GET /portal/v1/get-items` — owned classes, bootcamps, and digital products

### Wishlist, cart, and transactions

- `POST /wishlist/v1/add-to-wishlist`
- `GET /wishlist/v1/get-wishlist`
- `DELETE /wishlist/v1/remove-from-wishlist/:id`
- `POST /cart/v1/add-to-cart` — rejects items the user already owns
- `GET /cart/v1/get-cart`
- `DELETE /cart/v1/remove-from-cart/:id`
- `DELETE /cart/v1/clear-cart`
- `GET /orders/v1/get-recent-transactions` — last 3 orders

### Merchant profile and settings

- `POST /merchants/v1/register`
- `GET /merchants/v1/get-public-merchant/:merchant` — **public** storefront by id or slug; stats, skills (Bidang), landing settings, and `is_owner` for the signed-in owner
- `GET /merchants/v1/get-profile`
- `PATCH /merchants/v1/update-profile` — includes logo (`avatar_asset_id`), banner (`cover_asset_id`), sanitized rich-text description, skills, and landing background and layout
- `GET /merchants/v1/get-notification-preferences`
- `PATCH /merchants/v1/update-notification-preferences`
- `POST /file-assets/v1/register-upload` — registers an uploaded S3 object for a purpose: public images (`merchant_logo`, `merchant_banner`, `merchant_landing_background`, `user_avatar`, `class_cover`, `product_cover`) or private files (`class_resource`, `assignment_resource` up to 100 MB; `digital_file` up to 200 MB). Private files are only served through signed links that expire after 10 minutes

### Merchant dashboard

- `GET /merchants/v1/get-dashboard` — summary and merchant level; rating, latest review, and activity cover class and digital-product reviews
- `GET /merchants/v1/get-sales`
- `GET /merchants/v1/export-sales` — CSV
- `GET /merchants/v1/get-customers`
- `GET /merchants/v1/get-wallet` — earning, settled (withdrawable), and lifetime balances
- `GET /merchants/v1/get-balance-history`

### Merchant payout accounts (Rekening)

Account numbers are always returned masked. They are stored encrypted when `PAYOUT_ACCOUNT_ENCRYPTION_KEY` is set, and as plain text otherwise.

- `POST /merchants/v1/create-payout-account`
- `GET /merchants/v1/get-payout-accounts`
- `PATCH /merchants/v1/update-payout-account/:id`
- `PATCH /merchants/v1/set-primary-payout-account/:id`
- `DELETE /merchants/v1/delete-payout-account/:id`

### Merchant discounts

- `GET /discounts/v1/get-eligible-products`
- `POST /discounts/v1/create-discount` — codes are system-generated
- `GET /discounts/v1/get-discounts`
- `GET /discounts/v1/get-discount/:id`
- `PATCH /discounts/v1/update-discount/:id`
- `POST /discounts/v1/add-discount-codes/:id`
- `DELETE /discounts/v1/delete-discount-code/:codeId`
- `DELETE /discounts/v1/delete-discount/:id`

### Merchant bundles

- `GET /bundles/v1/get-eligible-items`
- `POST /bundles/v1/create-bundle`
- `GET /bundles/v1/get-bundles`
- `GET /bundles/v1/get-bundle/:id`
- `PATCH /bundles/v1/update-bundle/:id`
- `DELETE /bundles/v1/delete-bundle/:id`
- `GET /bundles/v1/get-public-bundles` — **public**; published bundles, optionally of one merchant

### Merchant digital products

- `GET /digital-products/v1/get-digital-products` — own products with downloads, rating, and revenue; filter by `status` (`published`, `unpublished`, `unlisted`) and `search`
- `GET /digital-products/v1/get-digital-product/:id` — includes a signed download link for the product file
- `POST /digital-products/v1/create-digital-product` — `category_slug`, prices, status, cover (`product_cover`), one file (`digital_file`, required to publish), post-purchase instructions
- `PATCH /digital-products/v1/update-digital-product/:id` — a new `file_asset_id` replaces the single file
- `DELETE /digital-products/v1/delete-digital-product/:id` — 409 while the product is in a published or unlisted bundle; buyers keep access

### Merchant classes and class management

The class owner has full access. Assigned tutors (`lead`, `assistant`, `moderator`) act within their permission matrix (areas `materi`, `meeting`, `tugas`, `nilai`, `sertifikat` × `lihat`, `tambah`, `edit`, `delete`): missing permission is 403, anyone else gets 404. Class status `archived` means unlisted (hidden from lists, open by link). Writes return `{data, responseMessage}`; deletes return 204.

- `GET /merchants/v1/:merchantId/classes` — filter by `status` and `type`; `limit` up to 100
- `POST /merchants/v1/:merchantId/classes`
- `GET /api/v1/classes/:classId`
- `PATCH /api/v1/classes/:classId` — details, prices, cover (`class_cover`), post-purchase instructions; a lead tutor may change only title, description, cover, and instructions
- `GET /api/v1/classes/:classId/chapters` — chapters with videos and resources in order; file resources carry signed download links
- `POST /api/v1/classes/:classId/chapters`
- `PATCH /api/v1/classes/:classId/chapters/:chapterId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId` — also removes its videos and resources
- `PUT /api/v1/classes/:classId/chapters/:chapterId/order` — complete `video_ids` and `resource_ids` lists
- `POST /api/v1/classes/:classId/chapters/:chapterId/videos` — https YouTube or embed link
- `PATCH /api/v1/classes/:classId/chapters/:chapterId/videos/:videoId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId/videos/:videoId`
- `POST /api/v1/classes/:classId/chapters/:chapterId/resources` — `pdf`, `archive`, `image`, `file` (an uploaded `class_resource`) or `link` (https)
- `PATCH /api/v1/classes/:classId/chapters/:chapterId/resources/:resourceId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId/resources/:resourceId`
- `GET /api/v1/classes/:classId/meetings`
- `POST /api/v1/classes/:classId/meetings` — date `YYYY-MM-DD`, time `HH:mm`, https live link
- `PATCH /api/v1/classes/:classId/meetings/:meetingId`
- `GET /api/v1/classes/:classId/mentors` — tutors with name, email, avatar, role, and permissions
- `POST /api/v1/classes/:classId/mentors` — invite by email with a role; the role preset applies when no matrix is sent
- `PATCH /api/v1/classes/:classId/mentors/:classMentorId` — owner only
- `DELETE /api/v1/classes/:classId/mentors/:classMentorId` — owner only; the tutor loses access immediately
- `GET /api/v1/classes/:classId/students`
- `GET /api/v1/classes/:classId/assignments` — submission counts; correct answers only for the owner and tutors with `tugas` or `nilai` permission
- `POST /api/v1/classes/:classId/assignments` — future `due`, `file_upload` or `quiz` (2–4 options per multiple-choice question), optional `assignment_resource`
- `DELETE /api/v1/classes/:classId/assignments/:assignmentId`

### File upload (S3 multipart)

- `POST /api/v1/upload/initiate`
- `POST /api/v1/upload/presigned-urls`
- `POST /api/v1/upload/complete`

### Mentor

- `POST /mentors/v1/sign-up` — **public**; multipart with CV and skill certificate
- `POST /mentors/v1/register` — multipart with CV and skill certificate
- `GET /mentors/v1/get-mentor/:id` — **public**
- `GET /mentors/v1/get-profile`
- `PATCH /mentors/v1/update-profile`
- `GET /mentors/v1/get-assignments` — merchant, product, and class tutor assignments (with role and permissions)
- `GET /mentors/v1/get-dashboard` — stats, upcoming sessions, recent learner messages, class progress
- `GET /mentors/v1/get-classes` — assigned classes (Kelas-kelas), filterable by type and search
- `GET /mentors/v1/get-teaching-classes` — teaching history (Kelas Mentor on the profile)
- `GET /mentors/v1/get-documents` — CV and skill certificate with short-lived download URLs
- `PATCH /mentors/v1/update-documents` — replaces the CV and/or skill certificate (multipart)

### Class discussions

Open to the class's merchant owner, its assigned mentors, and enrolled learners; learners can reply but not start threads.

- `GET /discussions/v1/get-threads/:classId`
- `POST /discussions/v1/create-thread`
- `POST /discussions/v1/create-comment`

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

Database schema changes require a reviewed TypeORM migration in `src/database/migrations/pintar-pintar/`. Runtime synchronization is disabled (`synchronize: false`) and must stay disabled: it previously dropped foreign keys, unique constraints, and indexes on the shared database. Pending migrations run automatically when the application starts (`migrationsRun: true`), so every entity change must ship with its migration in the same commit, or the application fails with a missing-column error.

Write migrations so they succeed both on a database built only from migrations and on one where the objects already exist (`IF NOT EXISTS`, catalog checks). Declare identifier columns with an explicit `type: 'uuid'`; an untyped `@Column({ name: 'x_id' })` maps to `varchar`.

## Create Migration

```bash
$ npx typeorm migration:generate {{name}} -d dist/database/database.data-source.js
```

Then copy the migration file to `src/database/migrations`.

## License

Nest is [MIT licensed](LICENSE).
