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

Every route requires a Bearer token except those marked **public**. The full request and response schemas are in Swagger (below). Routes follow `/api/v1/<resource>[/<id>][/<action>]`: the HTTP method is the operation, `merchant/…`, `mentor/…` and `profile/…` act on the signed-in user's own store, mentor workspace and profile, and plural resources (`merchants/:merchant`, `mentors/:id`) are public pages.

### Authentication and user

- `POST /api/v1/auth/sign-up` — **public**
- `POST /api/v1/auth/sign-in` — **public**
- `PATCH /api/v1/auth/password` — current password required; other devices are signed out; `data.token` replaces this device's token
- `POST /api/v1/auth/end-other-sessions` — signs out every other device; `data.token` replaces this device's token
- `GET /api/v1/users/me` — `{data, responseMessage}` like every other route
- `PATCH /api/v1/users/me`
- `DELETE /api/v1/users/me` — frees the email for a new sign-up and deactivates the user's merchant (buyers keep access)

### Beranda (home)

- `GET /api/v1/home/statistics` — **public**; active learners, published classes and digital products, platform rating
- `GET /api/v1/home/bootcamps` — **public**
- `GET /api/v1/home/video-classes` — **public**
- `GET /api/v1/home/digital-products` — **public**
- `GET /api/v1/home/merchants` — **public**
- `GET /api/v1/home/testimonials` — **public**; well-rated class reviews

### Catalog (Kelas, Bootcamp, Produk Digital)

- `GET /api/v1/catalog/items` — **public**; filter by type, search (title, merchant name, category name, file format), level, category (slug or name), merchant (`merchant_id`), and digital file type (`file_format`); sort; paginate
- `GET /api/v1/catalog/categories` — **public**; category tree
- `GET /api/v1/catalog/classes/:id` — **public**; `covers`, syllabus, mentors, FAQ, and the bootcamp meeting schedule (status, duration, mentor), without video, file, or meeting links
- `GET /api/v1/catalog/digital-products/:id` — **public**; `covers`, file formats and sizes, without download links

### Promo

- `GET /api/v1/promo/items` — **public**; random discounted classes (`type=kelas`) or digital products (`type=digital`), up to 6
- `GET /api/v1/promo/vouchers` — **public**; `featured` (3) and `vouchers` (up to 6) from one random draw, without overlap while enough vouchers exist

### Vouchers

- `GET /api/v1/vouchers` — **public**; search, category, and merchant (`merchant_slug` or `merchant_id`) filters
- `GET /api/v1/vouchers/featured` — **public**; 3 random vouchers with tags
- `POST /api/v1/merchant/vouchers` — merchant
- `GET /api/v1/merchant/vouchers` — merchant
- `GET /api/v1/merchant/vouchers/:id` — merchant
- `PATCH /api/v1/merchant/vouchers/:id` — merchant
- `DELETE /api/v1/merchant/vouchers/:id` — merchant

### Class reviews

- `POST /api/v1/reviews` — enrolled learners only, one review per class
- `GET /api/v1/reviews/classes/:classId` — **public**; average, count, and paged reviews
- `GET /api/v1/reviews/digital-products/:productId` — **public**; reviews of a published digital product
- `GET /api/v1/reviews/merchants/:merchantId` — **public**; reviews of a merchant's classes and products (Review tab)

### Pusat Bantuan

- `GET /api/v1/faqs` — **public**
- `POST /api/v1/help-tickets` — **public**; anonymous unless a token is sent; 5 per visitor address per 10 minutes
- `GET /api/v1/help-tickets`
- `GET /api/v1/help-tickets/:id`

### Profile and Portal Saya

- `GET /api/v1/profile` — includes `member_since` and `onboarding {role, custom_role, skills, completed_at}`
- `PATCH /api/v1/profile`
- `PUT /api/v1/profile/onboarding` — onboarding pop-up: `role` (`mahasiswa`, `content_creator`, `professional`, `ibu_rumah_tangga`, `brand_bisnis`, `custom` + `custom_role`) and up to 20 `skills`; never grants the mentor or merchant role
- `GET /api/v1/profile/learning` — everything the user owns: enrolled classes (`kelas`) and bootcamps (`bootcamp`) with progress, and digital products with unexpired access; used for ownership checks and Portal Saya
- `GET /api/v1/users/:userId/profile` — **public** profile page: name, avatar, roles, expertise, learning and teaching statistics, teaching classes, issued certificates; never email or phone
- `GET /api/v1/profile/certificates` — issued class certificates with the class mentor; `skills` is the class Bidang
- `GET /api/v1/profile/statistics` — bootcamps, video classes, digital products, and certificates (Statistik Pembelajaran)
- `GET /api/v1/profile/portal-items` — owned classes, bootcamps, and digital products

### Wishlist, cart, and transactions

- `POST /api/v1/wishlist/items`
- `GET /api/v1/wishlist`
- `DELETE /api/v1/wishlist/items/:id`
- `POST /api/v1/cart/items` — rejects items the user already owns
- `GET /api/v1/cart`
- `DELETE /api/v1/cart/items/:id`
- `DELETE /api/v1/cart`
- `GET /api/v1/orders/recent` — last 3 orders, with order numbers
- `GET /api/v1/orders` — full history, paginated, filter by `status` (`pending`, `paid`, `expired`, `failed`, `cancelled`)

### Checkout and payment (Duitku POP)

- `POST /api/v1/orders/preview` — prices up to 20 items with up to one voucher and one discount code (each applies to its own merchant's items); writes nothing
- `POST /api/v1/orders` — creates one `ORD-YYYYMMDD-NNNN` order that stays payable for 60 minutes and returns Duitku's `payment_reference` (for `checkout.process`) and `payment_url`; a Rp0 order is paid at once, and totals between Rp1 and Rp9,999 are rejected
- `GET /api/v1/orders/:id` — the buyer's order for the return page; the payment link is included only while the order can be paid
- `POST /api/v1/orders/:id/cancel` — cancels an unpaid order and releases its codes
- `POST /api/v1/orders/:id/check-payment` — asks Duitku for the status of an unpaid order (recovers a missed notification); 10 per minute per client
- `POST /api/v1/payments/duitku/callback` — **public**; Duitku's signed payment notification, the only source that marks an order paid

Payment grants class enrolments and digital-product access (bundles expanded), removes the items from the cart, and credits each merchant's wallet with the item price minus its code discounts. Income becomes withdrawable on Duitku's settlement date (H+4 when none is reported). Unpaid orders expire every minute; settlement runs every 30 minutes.

Deployment needs the six `PAYMENT_*` variables in `.env.example`. `PAYMENT_GATEWAY_URL` is the POP API base (`https://api-sandbox.duitku.com/api` or `https://api-prod.duitku.com/api`), not the demo page. The callback and return URLs are sent with every invoice, so nothing has to be registered in the Duitku dashboard; `PAYMENT_CALLBACK_URL` must be public on port 80 or 443, and Cloudflare must let Duitku's POSTs to `/api/v1/payments/duitku/callback` through (no bot challenge on that path).

### Merchant profile and settings

- `POST /api/v1/merchant/register`
- `GET /api/v1/merchants/:merchant` — **public** storefront by id or slug; stats, skills (Bidang), landing settings, and `is_owner` for the signed-in owner
- `GET /api/v1/merchant/profile` — includes `level` (see Merchant levels)
- `PATCH /api/v1/merchant/profile` — includes logo (`avatar_asset_id`), banner (`cover_asset_id`), sanitized rich-text description, skills, and landing background and layout
- `GET /api/v1/merchant/notification-preferences`
- `PATCH /api/v1/merchant/notification-preferences`

### Merchant levels

Each store is Basic, Silver or Gold by its monthly revenue (net of paid sales, Asia/Jakarta months): Silver from Rp 2,500,000 and Gold from Rp 5,000,000. A daily job (00:30 WIB) evaluates the month that ended, once per store:
- a store moves straight to the level the month reaches; Gold drops by that month alone, Silver drops to Basic only after two months under Rp 2,500,000;
- a store with listed items and no paid sale in two counted months gets a warning; a further month without a sale soft-deletes its digital products, classes, bootcamps and bundles, ends buyers' access to them and deactivates its discounts and vouchers. Counted months are full months after tracking started (registration, or deploy for older stores) and after any earlier removal;
- every evaluation writes `notifications` rows for the owner (`merchant_level_evaluated`, plus `merchant_inactivity_warning` or `merchant_items_removed`) for the email sender.

Per-file upload limit by level: 1, 5 or 10 GB for class materials, assignment attachments and digital-product files. Storage quotas (30, 100, 200 GB) are shown only.

- `GET /api/v1/merchant/level-evaluations` — the store's monthly evaluations, newest first

### Merchant dashboard

- `GET /api/v1/merchant/dashboard` — summary and `level` (see Merchant levels); rating, latest review, and activity cover class and digital-product reviews
- `GET /api/v1/merchant/sales` — price, net after code discounts, and payment method per item; revenue figures across the dashboard use the net
- `GET /api/v1/merchant/sales/export` — CSV
- `GET /api/v1/merchant/customers`
- `GET /api/v1/merchant/wallet` — earning, settled (withdrawable), and lifetime balances
- `GET /api/v1/merchant/balance-history`
- `POST /api/v1/merchant/withdrawals` — "Tarik Saldo": minimum Rp100.000 from the settled balance, Rp5.000 fee, to the primary or a chosen payout account; the amount leaves the balance at once and is transferred manually

### Merchant analytics (Analitik)

Asia/Jakarta days; paid orders only, dated at payment; revenue is the merchant's net, as on the dashboard; a transaction is a paid order with the merchant's items.

- `GET /api/v1/merchant/analytics/student-growth` — `from`, `to` (YYYY-MM-DD), optional `granularity` (`day`/`month`/`year`; by default daily within a month, monthly within a year, otherwise yearly); running total of distinct class students (a person counts once; digital products excluded); at most 400 points
- `GET /api/v1/merchant/analytics/daily-sales` — `month` (YYYY-MM); transactions and revenue for every day, plus totals
- `GET /api/v1/merchant/analytics/monthly-revenue` — `year`; revenue for each month, plus the year total
- `GET /api/v1/merchant/analytics/summary` — `period` (`today`/`month`/`year`); conversion (buyers ÷ distinct visitors, at most 100%, null without visits), retention (buyers with another purchase from the merchant in the previous 90 days), and average order value, each compared with the same elapsed span of the previous period
- `POST /api/v1/analytics/visits` — **public**; `{target_type: storefront|class|digital_product, target_id, visitor_id}` from the storefront and detail pages; one visit per merchant, visitor, and day (a login makes the user the visitor); the merchant's own visits and bots are ignored; 60 per minute per client

### Merchant payout accounts (Rekening)

Account numbers are always returned masked. They are stored encrypted when `PAYOUT_ACCOUNT_ENCRYPTION_KEY` is set, and as plain text otherwise.

- `POST /api/v1/merchant/payout-accounts`
- `GET /api/v1/merchant/payout-accounts`
- `PATCH /api/v1/merchant/payout-accounts/:id`
- `POST /api/v1/merchant/payout-accounts/:id/set-primary`
- `DELETE /api/v1/merchant/payout-accounts/:id`

### Merchant discounts

- `GET /api/v1/merchant/discounts/eligible-items`
- `POST /api/v1/merchant/discounts` — codes are system-generated: a `once` entry of N creates N single-use codes ("Kode Sekali Pakai", at most 1,000 per request); a `recurring` entry creates one code shared up to its limit, usable once per user; an expired, failed or cancelled order releases it ("Kode Berulang")
- `GET /api/v1/merchant/discounts`
- `GET /api/v1/merchant/discounts/:id`
- `PATCH /api/v1/merchant/discounts/:id`
- `POST /api/v1/merchant/discounts/:id/codes`
- `DELETE /api/v1/merchant/discount-codes/:codeId`
- `DELETE /api/v1/merchant/discounts/:id`

### Covers (classes, bootcamps, digital products, bundles)

Each item has up to 5 ordered covers; the first is the main cover, returned as `cover_asset_id` / `cover_url` and used on cards. Create and update take `cover_asset_ids` (the whole ordered list; `[]` removes all) or the single `cover_asset_id` (sets the main cover and keeps the others; `null` removes the main cover), never both. Details, the merchant lists and the public bundle list return `covers: [{ asset_id, url }]`.

### Merchant bundles

- `GET /api/v1/merchant/bundles/eligible-items`
- `POST /api/v1/merchant/bundles`
- `GET /api/v1/merchant/bundles`
- `GET /api/v1/merchant/bundles/:id`
- `PATCH /api/v1/merchant/bundles/:id`
- `DELETE /api/v1/merchant/bundles/:id`
- `GET /api/v1/bundles` — **public**; published bundles, optionally of one merchant

### Merchant digital products

- `GET /api/v1/merchant/digital-products` — own products with downloads, rating, and revenue; filter by `status` (`published`, `unpublished`, `unlisted`) and `search`
- `GET /api/v1/merchant/digital-products/:id` — includes a signed download link for the product file
- `POST /api/v1/merchant/digital-products` — `category_slug`, prices, status, cover (`product_cover`), one file (`digital_file`, required to publish), post-purchase instructions
- `PATCH /api/v1/merchant/digital-products/:id` — a new `file_asset_id` replaces the single file
- `DELETE /api/v1/merchant/digital-products/:id` — 409 while the product is in a published or unlisted bundle; buyers keep access

### Merchant classes and class management

The class owner has full access. Assigned tutors (`lead`, `assistant`, `moderator`) act within their permission matrix (areas `materi`, `meeting`, `tugas`, `nilai`, `sertifikat` × `lihat`, `tambah`, `edit`, `delete`): missing permission is 403, anyone else gets 404. Class status `archived` means unlisted (hidden from lists, open by link). Writes return `{data, responseMessage}`; deletes return 204.

- `GET /api/v1/merchant/classes` — the signed-in owner's store; filter by `status` and `type`; `limit` up to 100
- `POST /api/v1/merchant/classes` — also accepts Bidang (`category`: Coding/Elektro/Mesin/Desain/Sipil/Kimia), `level` (Pemula/Menengah/Mahir), `duration`, `prerequisites`, and `learning_outcomes` (up to 20); `PATCH /api/v1/classes/:classId` updates them
- `GET /api/v1/classes/:classId`
- `PATCH /api/v1/classes/:classId` — details, prices, cover (`class_cover`), post-purchase instructions; a lead tutor may change only title, description, cover, and instructions
- `POST /api/v1/classes/:classId/duplicate` — owner only; `{type}`; a draft "(Salinan)" copy with details, syllabus, assignments, certificate settings, and FAQ (no learners, reviews, tutors, or meetings)
- `GET /api/v1/classes/:classId/faqs`, `POST /api/v1/classes/:classId/faqs` — `materi` permission; question up to 300, answer up to 3000 characters; at most 50 per class
- `PATCH /api/v1/classes/:classId/faqs/:faqId`, `DELETE /api/v1/classes/:classId/faqs/:faqId`
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
- `DELETE /api/v1/classes/:classId/meetings/:meetingId` — `meeting.delete`; soft delete; its attendance stops counting and automatic certificates are re-evaluated

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

- `GET /api/v1/learning/classes/:id` — chapters, videos (with YouTube id and completion), files as signed links, meetings with live links, FAQ, progress, next video, certificate
- `POST /api/v1/learning/videos/:videoId/complete` — idempotent; returns progress and the next video
- `GET /api/v1/learning/classes/:classId/assignments` — without answer keys; own latest submission
- `GET /api/v1/learning/assignments/:assignmentId/quiz`
- `POST /api/v1/learning/assignments/:assignmentId/submit` — a `submission_file` upload; replaces before the due time, late first submission accepted
- `POST /api/v1/learning/assignments/:assignmentId/submit-quiz` — every question answered; multiple choice scored at once
- `GET /api/v1/learning/classes/:classId/grades` — scores, feedback, Partisipasi and average
- `GET /api/v1/learning/meetings/:meetingId` — the check-in page (`/absensi`)
- `POST /api/v1/learning/meetings/:meetingId/check-in` — after the start; identity from the account; optional review
- `GET /api/v1/attendance/classes/:classId` — **public** attendance page (`/absensi/{classId}`): class, merchant, mentors, and the latest started meeting (or the next one); never the meeting link
- `POST /api/v1/attendance/classes/:classId/check-in` — **public**; `{name, email, feedback?}`; the email must belong to a learner enrolled in the class; checks in to the latest started meeting; 10 per 10 minutes per client
- `GET /api/v1/learning/digital-products/:id` — owned product with a signed download, also after the merchant deletes it

### File upload (S3 multipart)

- `POST /api/v1/upload/initiate`
- `POST /api/v1/upload/presigned-urls`
- `POST /api/v1/upload/complete` — also registers the file and returns its `asset_id`; send it in the form field the file is for. The field checks the file when the form is saved: covers, logos, banners, landing backgrounds and the user photo take PNG/JPG/WebP images (2 MB for logo and photo, otherwise 4 MB) and make the file public; class materials, assignment attachments and digital-product files (up to the store level's per-file limit: 1, 5 or 10 GB), submissions (PDF/DWG/ZIP, 20 MB), certificate files (PDF/PNG/JPG, 10 MB) and CVs (PDF/DOC/DOCX, 10 MB) make it private. A file used in a public field cannot go into a private one, or the reverse. Private files are only served through signed links that expire after 10 minutes

### Mentor

- `POST /api/v1/mentors/sign-up` — **public**; multipart with CV and skill certificate
- `POST /api/v1/mentor/register` — multipart with CV and skill certificate; also completes the mentor record of an accepted job applicant
- `GET /api/v1/mentors/:id` — **public**
- `GET /api/v1/mentor/profile`
- `PATCH /api/v1/mentor/profile`
- `GET /api/v1/mentor/assignments` — merchant, product, and class tutor assignments (with role and permissions)
- `GET /api/v1/mentor/dashboard` — stats, upcoming sessions, recent learner messages, class progress
- `GET /api/v1/mentor/classes` — assigned classes (Kelas-kelas), filterable by type and search
- `GET /api/v1/mentor/teaching-history` — teaching history (Kelas Mentor on the profile)
- `GET /api/v1/mentor/documents` — CV and skill certificate with short-lived download URLs
- `PATCH /api/v1/mentor/documents` — replaces the CV and/or skill certificate (multipart)

### Karir (job board and mentor recruitment)

Merchants publish teaching vacancies; any logged-in user applies once per vacancy. Statuses: `review` → `interview` → `accepted` or `rejected` (a rejected applicant can still be accepted; acceptance is final). Accepting makes the applicant an active mentor (`is_mentor`), adds them to the merchant's mentor list, and, when the vacancy has a class, assigns them as its `assistant` tutor.

- `GET /api/v1/job-postings` — **public**; active vacancies of active merchants with `keyword` (title, merchant, category, skills), `location`, `category`, `contract_type`, `work_type`, paging, applicant counts, `is_new` (7 days), and the board totals
- `GET /api/v1/job-postings/:id` — **public**; 404 once closed
- `POST /api/v1/merchant/job-postings` — active merchants only; category is one of the 5 form labels, `Part-Time`/`Full-Time`, `Remote`/`Hybrid`/`On-Site`, free-text salary, up to 20 skills, optional own `class_id`
- `GET /api/v1/merchant/job-postings` — own active vacancies
- `GET /api/v1/merchant/job-postings/:id`
- `PATCH /api/v1/merchant/job-postings/:id` — `class_id: null` unlinks the class; closed vacancies cannot be edited
- `POST /api/v1/merchant/job-postings/:id/close` — permanent; applications are kept
- `POST /api/v1/job-postings/:jobId/apply` — name, email, WhatsApp, LinkedIn, `cv_asset_id` (an uploaded PDF/DOC/DOCX up to 10 MB, or the applicant's mentor CV), optional note; 409 on a second application
- `GET /api/v1/job-applications` — Progress Lamaran; counts per status
- `GET /api/v1/merchant/job-applications` — filter by `job_id`, `status`, `search`; counts per status
- `GET /api/v1/merchant/job-applications/:id/cv` — signed CV link (10 minutes)
- `POST /api/v1/merchant/job-applications/:id/schedule-interview` — `interview_at` (ISO 8601 with offset) and `interview_url`; rescheduling replaces both
- `POST /api/v1/merchant/job-applications/:id/accept`
- `POST /api/v1/merchant/job-applications/:id/reject`
- `GET /api/v1/merchant/mentors` — accepted applicants plus the tutors of the merchant's classes, with class counts and ratings, and the page summary
- `GET /api/v1/merchant/mentors/:userId` — the mentor's classes with students, ratings, and review counts

### Class discussions

Open to the class's merchant owner, its assigned mentors, and enrolled learners; learners can reply but not start threads.

- `GET /api/v1/discussions/threads` — `class_id` query parameter (required)
- `POST /api/v1/discussions/threads`
- `POST /api/v1/discussions/comments`

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
2. Duitku posts payment notifications to `PAYMENT_CALLBACK_URL`, which must be `https://<api-host>/api/v1/payments/duitku/callback`. It must be public on port 80 or 443, and Cloudflare must let `POST /api/v1/payments/duitku/callback` through without a bot challenge. Unpaid orders expire every minute, and settlement runs every 30 minutes.
3. Withdrawals are processed manually:
   - after transferring, set the payout's `status` to `success`;
   - when a transfer fails, set it to `failed` and add the amount back to the merchant wallet's `earning_balance` and `settled_balance`.

## License

Nest is [MIT licensed](LICENSE).
