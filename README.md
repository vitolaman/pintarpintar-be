# Pintar Pintar Backend

Backend API for Pintar Pintar.

## Description

NestJS, TypeORM and PostgreSQL API behind the Pintar Pintar frontend. It covers accounts, the catalog (classes, bootcamps, digital products, bundles), learning, merchant tools, vouchers and discount codes, cart and wishlist, checkout with Duitku POP, and merchant wallets.

## Installation

```bash
$ cp .env.example .env   # then fill in the values (see Deployment and environment)
$ npm ci                 # or: yarn install (both lockfiles are tracked)
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
- `PATCH /auth/change-password` — current password required; other devices are signed out; `data.token` replaces this device's token
- `POST /auth/end-other-sessions` — signs out every other device; `data.token` replaces this device's token
- `GET /users/me` — `{data, responseMessage}` like every other route
- `PATCH /users/me`
- `DELETE /users/me` — frees the email for a new sign-up and deactivates the user's merchant (buyers keep access)

### Beranda (home)

- `GET /home/v1/get-statistics` — **public**; active learners, published classes and digital products, platform rating
- `GET /home/v1/get-bootcamps` — **public**
- `GET /home/v1/get-video-classes` — **public**
- `GET /home/v1/get-digital-products` — **public**
- `GET /home/v1/get-merchants` — **public**
- `GET /home/v1/get-testimonials` — **public**; well-rated class reviews

### Catalog (Kelas, Bootcamp, Produk Digital)

- `GET /catalog/v1/get-items` — **public**; filter by type, search (title, merchant name, category name, file format), level, category (slug or name), merchant (`merchant_id`), and digital file type (`file_format`); sort; paginate
- `GET /catalog/v1/get-categories` — **public**; category tree
- `GET /catalog/v1/get-class/:id` — **public**; syllabus, mentors, and the bootcamp meeting schedule (status, duration, mentor), without video, file, or meeting links
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
- `GET /reviews/v1/get-product-reviews/:productId` — **public**; reviews of a published digital product
- `GET /reviews/v1/get-merchant-reviews/:merchantId` — **public**; reviews of a merchant's classes and products (Review tab)

### Pusat Bantuan

- `GET /faqs/v1/get-public-faqs` — **public**
- `POST /help-tickets/v1/create-help-ticket` — **public**; anonymous unless a token is sent; 5 per visitor address per 10 minutes
- `GET /help-tickets/v1/get-help-tickets`
- `GET /help-tickets/v1/get-help-ticket/:id`

### Profile and Portal Saya

- `GET /profile/v1/get-profile` — includes `member_since`
- `PATCH /profile/v1/update-profile`
- `GET /profile/v1/get-learning` — everything the user owns: enrolled classes (`kelas`) and bootcamps (`bootcamp`) with progress, and digital products with unexpired access; used for ownership checks and Portal Saya
- `GET /profile/v1/get-public-profile/:userId` — **public** profile page: name, avatar, roles, expertise, learning and teaching statistics, teaching classes, issued certificates; never email or phone
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
- `GET /orders/v1/get-recent-transactions` — last 3 orders, with order numbers
- `GET /orders/v1/get-transactions` — full history, paginated, filter by `status` (`pending`, `paid`, `expired`, `failed`, `cancelled`)

### Checkout and payment (Duitku POP)

- `POST /orders/v1/preview-checkout` — prices up to 20 items with up to one voucher and one discount code (each applies to its own merchant's items); writes nothing
- `POST /orders/v1/checkout` — creates one `ORD-YYYYMMDD-NNNN` order that stays payable for 60 minutes and returns Duitku's `payment_reference` (for `checkout.process`) and `payment_url`; a Rp0 order is paid at once, and totals between Rp1 and Rp9,999 are rejected
- `GET /orders/v1/get-order/:id` — the buyer's order for the return page; the payment link is included only while the order can be paid
- `POST /orders/v1/cancel-order/:id` — cancels an unpaid order and releases its codes
- `POST /orders/v1/check-payment/:id` — asks Duitku for the status of an unpaid order (recovers a missed notification); 10 per minute per client
- `POST /payments/v1/duitku-callback` — **public**; Duitku's signed payment notification, the only source that marks an order paid

Payment grants class enrolments and digital-product access (bundles expanded), removes the items from the cart, and credits each merchant's wallet with the item price minus its code discounts. Income becomes withdrawable on Duitku's settlement date (H+4 when none is reported). Unpaid orders expire every minute; settlement runs every 30 minutes.

Deployment needs the six `PAYMENT_*` variables in `.env.example`. `PAYMENT_GATEWAY_URL` is the POP API base (`https://api-sandbox.duitku.com/api` or `https://api-prod.duitku.com/api`), not the demo page. The callback and return URLs are sent with every invoice, so nothing has to be registered in the Duitku dashboard; `PAYMENT_CALLBACK_URL` must be public on port 80 or 443, and Cloudflare must let Duitku's POSTs to `/payments/v1/duitku-callback` through (no bot challenge on that path).

### Merchant profile and settings

- `POST /merchants/v1/register`
- `GET /merchants/v1/get-public-merchant/:merchant` — **public** storefront by id or slug; stats, skills (Bidang), landing settings, and `is_owner` for the signed-in owner
- `GET /merchants/v1/get-profile`
- `PATCH /merchants/v1/update-profile` — includes logo (`avatar_asset_id`), banner (`cover_asset_id`), sanitized rich-text description, skills, and landing background and layout
- `GET /merchants/v1/get-notification-preferences`
- `PATCH /merchants/v1/update-notification-preferences`
- `POST /file-assets/v1/register-upload` — registers an uploaded S3 object for a purpose: public images (`merchant_logo`, `merchant_banner`, `merchant_landing_background`, `user_avatar`, `class_cover`, `product_cover`) or private files (`class_resource`, `assignment_resource` up to 100 MB; `digital_file` up to 200 MB; `submission_file` PDF/DWG/ZIP up to 20 MB; `certificate_file` PDF/PNG/JPG up to 10 MB). Private files are only served through signed links that expire after 10 minutes

### Merchant dashboard

- `GET /merchants/v1/get-dashboard` — summary and merchant level; rating, latest review, and activity cover class and digital-product reviews
- `GET /merchants/v1/get-sales` — price, net after code discounts, and payment method per item; revenue figures across the dashboard use the net
- `GET /merchants/v1/export-sales` — CSV
- `GET /merchants/v1/get-customers`
- `GET /merchants/v1/get-wallet` — earning, settled (withdrawable), and lifetime balances
- `GET /merchants/v1/get-balance-history`
- `POST /merchants/v1/request-withdrawal` — "Tarik Saldo": minimum Rp100.000 from the settled balance, Rp5.000 fee, to the primary or a chosen payout account; the amount leaves the balance at once and is transferred manually

### Merchant payout accounts (Rekening)

Account numbers are always returned masked. They are stored encrypted when `PAYOUT_ACCOUNT_ENCRYPTION_KEY` is set, and as plain text otherwise.

- `POST /merchants/v1/create-payout-account`
- `GET /merchants/v1/get-payout-accounts`
- `PATCH /merchants/v1/update-payout-account/:id`
- `PATCH /merchants/v1/set-primary-payout-account/:id`
- `DELETE /merchants/v1/delete-payout-account/:id`

### Merchant discounts

- `GET /discounts/v1/get-eligible-products`
- `POST /discounts/v1/create-discount` — codes are system-generated: a `once` entry of N creates N single-use codes ("Kode Sekali Pakai", at most 1,000 per request); a `recurring` entry creates one code shared up to its limit ("Kode Berulang")
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
- `POST /merchants/v1/:merchantId/classes` — also accepts Bidang (`category`: Coding/Elektro/Mesin/Desain/Sipil/Kimia), `level` (Pemula/Menengah/Mahir), `duration`, `prerequisites`, and `learning_outcomes` (up to 20); `PATCH /api/v1/classes/:classId` updates them
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
- `POST /api/v1/classes/:classId/meetings` — live bootcamps only (400 for video classes); date `YYYY-MM-DD`, time `HH:mm`, https live link, optional `duration_minutes` (1–1440) and `mentor_id` (an active tutor of the class)
- `PATCH /api/v1/classes/:classId/meetings/:meetingId` — `null` clears the duration and mentor

Meeting responses include `duration_minutes` and `mentor {id, name}`. `status` is `upcoming` until the start plus the duration (180 minutes when unset) has passed, then `completed`. A live bootcamp that has meetings cannot become a video class.
- `GET /api/v1/classes/:classId/mentors` — tutors with name, email, avatar, role, and permissions
- `POST /api/v1/classes/:classId/mentors` — invite by email with a role; the role preset applies when no matrix is sent
- `PATCH /api/v1/classes/:classId/mentors/:classMentorId` — owner only
- `DELETE /api/v1/classes/:classId/mentors/:classMentorId` — owner only; the tutor loses access immediately
- `GET /api/v1/classes/:classId/students`
- `GET /api/v1/classes/:classId/assignments` — submission counts; correct answers only for the owner and tutors with `tugas` or `nilai` permission
- `POST /api/v1/classes/:classId/assignments` — future `due`, `file_upload` or `quiz` (2–4 options per multiple-choice question), optional `assignment_resource`
- `DELETE /api/v1/classes/:classId/assignments/:assignmentId`
- `GET /api/v1/classes/:classId/assignments/:assignmentId/submissions` — `nilai.lihat`; latest submission per learner with file link and answers
- `PATCH /api/v1/classes/:classId/submissions/:submissionId/grade` — `nilai.edit`; file score 0–100, or essay scores up to each weight; feedback
- `GET /api/v1/classes/:classId/grades` — `nilai.lihat`; scores per learner and assignment, learner and class averages
- `GET /api/v1/classes/:classId/attendance-summary` — `meeting.lihat`
- `GET /api/v1/classes/:classId/meetings/:meetingId/attendances` — `meeting.lihat`; no record counts as `alpa`
- `PATCH /api/v1/classes/:classId/meetings/:meetingId/attendances/:userId` — `meeting.edit`; `hadir`, `izin` or `alpa`
- `GET /api/v1/classes/:classId/certificate-settings` — defaults: manual, attendance 80, score 75
- `PATCH /api/v1/classes/:classId/certificate-settings` — `sertifikat.edit`
- `GET /api/v1/classes/:classId/certificates` — `sertifikat.lihat`; status `issued`, `pending` or `ineligible` per learner
- `POST /api/v1/classes/:classId/certificates/:userId/issue` — `sertifikat.tambah`; eligible learners only; numbers `PP-CERT-YYYY-NNNN`
- `PUT /api/v1/classes/:classId/certificates/:userId/file` — `sertifikat.edit`; a `certificate_file` upload
- `DELETE /api/v1/classes/:classId/certificates/:userId` — `sertifikat.delete`; withdraws the certificate

### Learning (enrolled learners and buyers)

Every route requires an active enrollment or product access and answers 404 otherwise.

- `GET /learning/v1/get-class/:id` — chapters, videos (with YouTube id and completion), files as signed links, meetings with live links, progress, next video, certificate
- `POST /learning/v1/complete-video/:videoId` — idempotent; returns progress and the next video
- `GET /learning/v1/get-assignments/:classId` — without answer keys; own latest submission
- `GET /learning/v1/get-quiz/:assignmentId`
- `POST /learning/v1/submit-assignment/:assignmentId` — a `submission_file` upload; replaces before the due time, late first submission accepted
- `POST /learning/v1/submit-quiz/:assignmentId` — every question answered; multiple choice scored at once
- `GET /learning/v1/get-grades/:classId` — scores, feedback, Partisipasi and average
- `GET /learning/v1/get-meeting/:meetingId` — the check-in page (`/absensi`)
- `POST /learning/v1/check-in/:meetingId` — after the start; identity from the account; optional review
- `GET /learning/v1/get-attendance-session/:classId` — **public** attendance page (`/absensi/{classId}`): class, merchant, mentors, and the latest started meeting (or the next one); never the meeting link
- `POST /learning/v1/check-in-by-email/:classId` — **public**; `{name, email, feedback?}`; the email must belong to a learner enrolled in the class; checks in to the latest started meeting; 10 per 10 minutes per client
- `GET /learning/v1/get-digital-product/:id` — owned product with a signed download, also after the merchant deletes it

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

`npm run test:e2e` fails before running on Node 26 (a dependency uses the removed `SlowBuffer`); run it on Node 20 or 22.

Database schema changes require a reviewed TypeORM migration in `src/database/migrations/pintar-pintar/`. Runtime synchronization is disabled (`synchronize: false`) and must stay disabled: it previously dropped foreign keys, unique constraints, and indexes on the shared database. Pending migrations run automatically when the application starts (`migrationsRun: true`), so every entity change must ship with its migration in the same commit, or the application fails with a missing-column error.

Write migrations so they succeed both on a database built only from migrations and on one where the objects already exist (`IF NOT EXISTS`, catalog checks). Declare identifier columns with an explicit `type: 'uuid'`; an untyped `@Column({ name: 'x_id' })` maps to `varchar`.

## Create Migration

Write migrations by hand in `src/database/migrations/pintar-pintar/`, named `<timestamp>-<what-it-does>.ts`, idempotent (`IF NOT EXISTS`, catalog checks) and guarded: check existing data before adding a constraint, and abort with a clear message instead of failing halfway. `migration:generate` is not used, because entities describe columns only; constraints and indexes live in the migrations.

```bash
# apply to the local database, then check the status
$ npm run db:local:migrate
$ npm run db:local:status
```

Verify each migration locally on a database built only from migrations and on a copy of the shared schema. It must converge to the same schema, and a second run must be a no-op. `migration:revert` must restore the previous schema.

## Deployment and environment

Every variable is listed in `.env.example`.

**Required:**
- `DB_*`.
- `JWT_ADMIN_KEY`: the application refuses to start without it. Changing it signs every user out.
- The S3 settings (`AWS_*`) for uploads and private files.
- `ASSET_PUBLIC_BASE_URL`, or image URLs are `null`.
- The six `PAYMENT_*` settings, or paid checkout answers 503.

**Optional:**
- `PAYOUT_ACCOUNT_ENCRYPTION_KEY`: never change or remove it once used.
- The `OTEL_*` tracing settings.
- `ENV_FILE`, which selects the env file (default `.env`).

**Deploy steps:**
1. Before the first deploy to a database, run `openspec/changes/restore-shared-schema-integrity/preconditions.sql` (read-only) against it. Pending migrations then run automatically at startup (`migrationsRun: true`), and a migration whose guard fails stops the startup with its message.
2. Duitku posts payment notifications to `PAYMENT_CALLBACK_URL`. It must be public on port 80 or 443, and Cloudflare must let `POST /payments/v1/duitku-callback` through without a bot challenge. Unpaid orders expire every minute, and settlement runs every 30 minutes.
3. Withdrawals are processed manually:
   - after transferring, set the payout's `status` to `success`;
   - when a transfer fails, set it to `failed` and add the amount back to the merchant wallet's `earning_balance` and `settled_balance`.

## License

Nest is [MIT licensed](LICENSE).
