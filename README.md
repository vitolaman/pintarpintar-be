# Pintar Pintar Backend

Backend API for Pintar Pintar.

## Description

NestJS, TypeORM and PostgreSQL API behind the Pintar Pintar frontend. It covers accounts, the catalog (classes, bootcamps, digital products, bundles), learning, merchant tools, vouchers and discount codes, cart and wishlist, checkout with Duitku POP, and merchant wallets.

## Installation

```bash
$ cp .env.example .env         # then fill in the values (see Deployment and environment)
$ cp .env.example .env.local   # for the local Compose database: start:local and db:local:* read it
$ npm ci                       # or: yarn install (both lockfiles are tracked)
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

Every route requires a Bearer token except those marked **public**; on a public route a token is optional, and an invalid or expired one is ignored (the caller counts as a visitor). The full request and response schemas are in Swagger (below). Routes follow `/api/v1/<resource>[/<id>][/<action>]`: the HTTP method is the operation, `merchant/…`, `mentor/…` and `profile/…` act on the signed-in user's own store, mentor workspace and profile, and `merchants/:merchant`, `mentors/:id` and `users/:userId/profile` are the public pages of a store, a mentor and a user. Path ids are UUIDs; anything else is a 400.

Responses are `{data, responseMessage}`; a delete that answers 204 has no body. Paginated lists take `page` (default 1) and `limit` (default 10, at most 100). A blank or non-numeric value means the default and an out-of-range value is clamped to the nearest bound (a page past the last one returns an empty `data`), so paging never fails a request. They return `meta: {page, limit, total, total_page}` next to `data`, also when the list sits inside an object (job board, applications, class grades, reviews). A few lists take only a `limit` and return no `meta`: the home collections (default 10, at most 50), the promo items and vouchers (default and at most 6) and the recent orders (default 3, at most 20). Errors are `{statusCode, error, responseMessage, errors?}`: `error` is the status name (`BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `TOO_MANY_REQUESTS`, …), `responseMessage` is one message (a rate limit answers "Too many requests, please try again later"), and a validation failure (also an unknown query parameter) lists every reason in `errors`. Some errors add a `details` object, for example the pending `order_id` of the "awaiting payment" 409. Every stored image in a response comes with a ready `*_url` (`image_url`, `cover_url`, `avatar_url`, …), `null` without an image, so the client never needs the storage base URL; outside the S3 upload flow, responses carry no storage object keys.

Request fields follow the same rules everywhere. An optional text field is cleared with `""` or `null`; a field the data needs (a title, a name, a mentor's phone) rejects `""`, whitespace and `null`. Text is trimmed (passwords are not). Choice values (`type`, `status`, `level`, `badge`, sort values) match ignoring case and surrounding spaces and are stored in their canonical spelling. Numbers may be sent as numeric strings, and a blank optional number means "not sent". A blank query filter (`?search=`, `?category=`, `?sub=`, `?status=`) means no filter. Wherever an item id is sent (cart, wishlist, checkout, bundle items, discount targets), `type` is optional: the server resolves it from the id, and a sent `type` only has to name the right family (`kelas` and `bootcamp` both accept any class).

Naming is the same everywhere: fields are snake_case (the envelope keys `responseMessage` and `statusCode`, and the S3 upload and Duitku callback bodies, are the documented exceptions), and an item kind is always `kelas` (video class), `bootcamp`, `digital` or `bundle`. Prices are `price`, `original_price`, `discount_price`, `discount_amount` and `discount_percent`; discounts and vouchers share `minimum_purchase`, `starts_at`, `ends_at`, `usage_limit` and `used_count`. Lists search with `search` and order with `sort_by` and `sort_order` (`asc`/`desc`). A request body or query field the endpoint does not define — a typo or an old name — is a 400 naming it, also on a route that takes no query parameters (the Duitku callback ignores the extra fields Duitku sends).

The 2026-10-03 renames (one coordinated frontend release):

| Where                                                                    | Before                                                                                             | Now                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| class create/update/response                                             | `originalPrice`, `discountedPrice`                                                                 | `original_price`, `discount_price`                                                                                                                                                    |
| class `type` (management, learner, mentor workspace, roster, attendance) | `video`, `live-bootcamp`; attendance `class_type`                                                  | `kelas`, `bootcamp`; `type`                                                                                                                                                           |
| videos, meetings, students                                               | `youtubeUrl`, `liveUrl`, `joinDate`                                                                | `youtube_url`, `live_url`, `join_date`                                                                                                                                                |
| check-in and attendance comment                                          | `review`, `notes`                                                                                  | `feedback`                                                                                                                                                                            |
| class and learning file `size`, catalog chapter file `size`              | text                                                                                               | number of bytes (null when unknown)                                                                                                                                                   |
| pagination `meta`                                                        | `totalPage`                                                                                        | `total_page`                                                                                                                                                                          |
| error body                                                               | `responseMessage: string[]`                                                                        | `responseMessage: string`, `errors: string[]`                                                                                                                                         |
| vouchers                                                                 | `minimum_order_amount`, `expires_at`, `max_uses`, `usage_count`                                    | `minimum_purchase`, `ends_at`, `usage_limit`, `used_count`                                                                                                                            |
| discounts `status`                                                       | —                                                                                                  | adds `limit_reached`                                                                                                                                                                  |
| bundles                                                                  | `bundle_price`, `original_total`, `saving_amount`, `saving_percent`; item `class_type`             | `price`, `original_price`, `discount_amount`, `discount_percent`; item `type` `kelas`/`bootcamp`/`digital`                                                                            |
| portal items and `?type=`                                                | `kelas-video`, `live-bootcamp`, `produk-digital`                                                   | `kelas`, `bootcamp`, `digital` (and `all`)                                                                                                                                            |
| `/profile/learning`                                                      | `product_id`, `product_type`                                                                       | `item_id`, `item_type`                                                                                                                                                                |
| visits `target_type`                                                     | `class`, `digital_product`                                                                         | `kelas`, `bootcamp`, `digital`, `bundle` (and `storefront`)                                                                                                                           |
| catalog `?sort=`                                                         | `terbaru`, `terlama`, `terpopuler`, `terkurang-populer`, `termurah`, `termahal`, `rating`, `title` | `sort_by` `created_at`, `popularity`, `price`, `rating`, `title` with `sort_order`; each field has a natural default (newest, most popular, best rated first; cheapest and A–Z first) |
| promo `?type=`, `?sort=`                                                 | `kelas` (classes and bootcamps) or `digital`; `sort`                                               | comma-separated kinds (default `kelas,bootcamp`); `sort_by`/`sort_order` (omit for a random pick)                                                                                     |
| job board `?keyword=`                                                    | `keyword`                                                                                          | `search`                                                                                                                                                                              |
| images                                                                   | `*_object_key`, image-only `*_asset_id`                                                            | removed; use the `*_url` siblings (editors keep the asset ids they send back)                                                                                                         |
| mentor registration                                                      | multipart `cv`, `skill_certificate`; the public mentor sign-up (removed)                           | JSON `cv_asset_id`, `skill_certificate_asset_id` from the normal upload flow; sign up as a user first                                                                                 |

The catalog keeps accepting `kelas-live` in `type` (the "Kelas Live" filter); it matches no items until that kind exists (PM item 21).

### Authentication and user

- `POST /api/v1/auth/sign-up` — **public**; 200 with `data: {token, user}` (`user` as in `GET /api/v1/users/me`); 409 when the email is registered
- `POST /api/v1/auth/sign-in` — **public**; `data: {token, user}`; a wrong email or password is 403
- `PATCH /api/v1/auth/password` — current password required (a wrong one is 400); the new one has at least 8 characters with a digit and differs from the current one; other devices are signed out; `data.token` replaces this device's token
- `POST /api/v1/auth/end-other-sessions` — signs out every other device; `data.token` replaces this device's token
- `POST /api/v1/auth/password-reset` — **public**; `email`; always 200 `{data: null, responseMessage: "If the email is registered, a reset link has been sent"}`, so it reveals no accounts. An active account gets the "Atur ulang kata sandi" email with a single-use link to `<frontend>/reset-password?token=…`, valid for 60 minutes; at most one email a minute and five an hour per account; 5 requests per 10 minutes per client address (429)
- `POST /api/v1/auth/password-reset/confirm` — **public**; `token` (from the link) and `new_password` (at least 8 characters with a digit); 200 `{data: null, responseMessage: "Password reset"}` signs the account out everywhere, makes every reset link of the account unusable and emails the "Kata sandi diubah" notice; an unknown, malformed, expired or used token is 400 "This reset link is invalid or has expired"; 10 requests per 10 minutes per client address (429). Frontend flow: `/reset-password` without `token` asks for the email and calls the first route; with `token` it asks for the new password and calls this one, then sends the user to `/login`
- `GET /api/v1/users/me` — `{data, responseMessage}` like every other route
- `PATCH /api/v1/users/me` — `name` only (up to 120 characters); returns the same user object as `GET`
- `DELETE /api/v1/users/me` — returns the account as it was; its tokens stop working; frees the email for a new sign-up and deactivates the user's merchant (buyers keep access)

### Beranda (home)

The collections take `limit` (default 10, at most 50) and return the newest first.

- `GET /api/v1/home/statistics` — **public**; active learners (enrolled, or with unexpired digital-product access), published classes and digital products, platform rating (average of every review)
- `GET /api/v1/home/bootcamps` — **public**; with `in_wishlist`
- `GET /api/v1/home/video-classes` — **public**; with `in_wishlist`
- `GET /api/v1/home/digital-products` — **public**; with `in_wishlist`
- `GET /api/v1/home/merchants` — **public**; active merchants, each with its latest published digital product (`best_product_*`)
- `GET /api/v1/home/testimonials` — **public**; reviews of 4 or 5 stars with a comment on published classes; reviews of deleted accounts stay, as in every review list

### Catalog (Kelas, Bootcamp, Produk Digital)

- `GET /api/v1/catalog/items` — **public**; filter by `type` (comma-separated `kelas`, `bootcamp`, `digital`; blank means all), search (title, merchant name, category name, a whole file format), `level` (`Pemula`, `Menengah`, `Mahir`), category (a digital-product category slug or name, which includes its sub-categories, or a class Bidang), sub-category (`sub`, a slug or name; narrows digital products to that sub-category, must also match `category` when both are sent, never matches classes), merchant (`merchant_id`), and digital file type (`file_format`, comma-separated); `sort_by` + `sort_order` (default newest first); paginate; each card has `in_wishlist` (false without a login token; also on the home and promo cards)
- `GET /api/v1/catalog/categories` — **public**; the digital-product category tree (Desain Grafis › Photoshop, Illustrator, Figma; Videografi › Video Effect, Sound Effect, Video Animasi)
- `GET /api/v1/catalog/classes/:id` — **public**; also an archived (unlisted) class; with a login token `in_wishlist`, `in_cart`, `has_reviewed` and `is_owned` (also on the digital product detail); `covers`, syllabus, mentors, FAQ, and the bootcamp meeting schedule (status, duration, mentor), without video, file, or meeting links
- `GET /api/v1/catalog/digital-products/:id` — **public**; `covers`, file formats and sizes, without download links

### Promo

- `GET /api/v1/promo/items` — **public**; discounted items of the kinds in `type` (comma-separated `kelas`, `bootcamp`, `digital`; default `kelas,bootcamp`), a random pick unless `sort_by`/`sort_order` is sent; `limit` up to 6
- `GET /api/v1/promo/vouchers` — **public**; `featured` (3) and `vouchers` (up to 6) from one random draw, without overlap while enough vouchers exist

### Vouchers

- `GET /api/v1/vouchers` — **public**; usable vouchers of active merchants, paginated; `search` (name, code, description, store name), `category_slug`, and merchant (`merchant_slug` or `merchant_id`) filters
- `GET /api/v1/vouchers/featured` — **public**; 3 random usable vouchers (every public voucher carries a `tag`)
- `POST /api/v1/merchant/vouchers` — merchant
- `GET /api/v1/merchant/vouchers` — merchant
- `GET /api/v1/merchant/vouchers/:id` — merchant
- `PATCH /api/v1/merchant/vouchers/:id` — merchant
- `DELETE /api/v1/merchant/vouchers/:id` — merchant

### Class reviews

- `POST /api/v1/reviews` — `class_id` (enrolled learners) or `product_id` (buyers with unexpired access), `rating` 1–5, optional `comment`; one review per class or product (409 for a second)
- `GET /api/v1/reviews/classes/:classId` — **public**; average, count, and paged reviews. Each review has `helpful_count`, `viewer_has_voted`, `is_own_review` and `replies` (oldest first, with `author_role` `merchant`, `mentor` or `buyer`); `viewer_can_reply` says whether the caller may reply. The caller fields are false without a token
- `GET /api/v1/reviews/digital-products/:productId` — **public**; reviews of a published digital product, with the same fields
- `PUT /api/v1/reviews/:id/helpful` — marks a review "Membantu", once per user (repeating changes nothing); not on your own review (403). Returns `helpful_count` and `viewer_has_voted`
- `DELETE /api/v1/reviews/:id/helpful` — removes the caller's mark (repeating changes nothing); returns the same fields
- `POST /api/v1/reviews/:id/replies` — `{comment}` (1–2,000 characters); enrolled learners or buyers of the item, its merchant owner and the class's active mentors (others 403); the reply keeps the author's role; no edit or delete; 10 replies a minute per client address
- `GET /api/v1/reviews/merchants/:merchantId` — **public**; reviews of a merchant's classes and products (Review tab)

### Pusat Bantuan

- `GET /api/v1/faqs` — **public**
- `POST /api/v1/help-tickets` — **public**; anonymous unless a valid token is sent; 5 per visitor address per 10 minutes (429 beyond)
- `GET /api/v1/help-tickets` — the caller's tickets, paginated
- `GET /api/v1/help-tickets/:id` — one of the caller's tickets

### Profile and Portal Saya

- `GET /api/v1/profile` — includes `member_since` and `onboarding {role, custom_role, skills, completed_at}`
- `PATCH /api/v1/profile`
- `PUT /api/v1/profile/onboarding` — onboarding pop-up: `role` (`mahasiswa`, `content_creator`, `professional`, `ibu_rumah_tangga`, `brand_bisnis`, `custom` + `custom_role`) and up to 20 `skills` (50 characters each); saving again replaces the answers; never grants the mentor or merchant role
- `GET /api/v1/profile/learning` — everything the user can open, not paginated: enrolled classes (`kelas`) and bootcamps (`bootcamp`), and digital products with unexpired access, also after their merchant deletes them, each with progress. Bundles are not listed (the catalog's `is_owned` covers them)
- `GET /api/v1/users/:userId/profile` — **public** profile page: name, avatar, headline, bio, `member_since`, roles, store link (`merchant`), mentor expertise, learning and teaching statistics, teaching classes, issued certificates (without files or scores); never email or phone
- `GET /api/v1/profile/certificates` — issued class certificates with the class's first mentor; `skills` is the class Bidang
- `GET /api/v1/profile/statistics` — bootcamps, video classes, digital products, and certificates (Statistik Pembelajaran)
- `GET /api/v1/profile/portal-items` — owned classes, bootcamps, and digital products (also those their merchant deleted), paginated; `type` (`all`, `kelas`, `bootcamp`, `digital`) and `search` filters

### Wishlist, cart, and transactions

- `POST /api/v1/wishlist/items` — `{id}` (`type` optional); 201 with the entry, also when it is already there; rejects unavailable items
- `GET /api/v1/wishlist` — paginated
- `DELETE /api/v1/wishlist/items/:id` — the entry id or the item's own id; 204
- `POST /api/v1/cart/items` — `{id}` (`type` optional); returns the cart: 201 for a new item, 200 when it is already there; rejects items the user already owns, by the checkout rule (a bundle also counts as owned when every item in it is)
- `GET /api/v1/cart`
- `DELETE /api/v1/cart/items/:id` — the entry id or the item's own id; returns the updated cart (200)
- `DELETE /api/v1/cart` — returns the empty cart (200)
- `GET /api/v1/orders/recent` — the latest orders (`limit`, default 3, at most 20), with order numbers
- `GET /api/v1/orders` — full history, paginated, filter by `status` (`pending`, `paid`, `expired`, `failed`, `cancelled`; an unpaid order past its window already reads as `expired`); items carry `image_url` and `merchant_name`

### Checkout and payment (Duitku POP)

- `POST /api/v1/orders/preview` — prices up to 20 items with up to one voucher and one discount code (each applies to its own merchant's items); writes nothing. An invalid code does not fail the preview: it is left out and listed in `rejected_codes: [{code, reason}]` (`not_found`, `expired`, `not_started`, `used_up`, `already_used`, `minimum_not_met`, `not_applicable`); `POST /api/v1/orders` still rejects it. Unavailable, owned or repeated items and two codes of one kind are a 400 in both
- `POST /api/v1/orders` — creates one `ORD-YYYYMMDD-NNNN` order that stays payable for 60 minutes and returns Duitku's `payment_reference` (for `checkout.process`) and `payment_url`; a Rp0 order is paid at once, and totals between Rp1 and Rp9,999 are rejected. 409 with `details.order_id` when an item already awaits payment in another order; 502 when Duitku fails (the order becomes `failed` and its codes are released); 503 when payment is not configured
- `GET /api/v1/orders/:id` — the buyer's order for the return page; the payment link is included only while the order can be paid; `payment_method` is the Duitku channel code and `payment_method_label` its name ("Gratis" for a free order, `null` while unpaid)
- `POST /api/v1/orders/:id/cancel` — cancels a pending order within its window and releases its codes
- `POST /api/v1/orders/:id/check-payment` — asks Duitku for the status of an unpaid order and applies a success like the callback (recovers a missed notification); 10 per minute per client address
- `POST /api/v1/payments/duitku/callback` — **public**; Duitku's signed payment notification: marks the order paid, or a pending order `failed` on any other result; a bad signature, an unknown order or a wrong amount is 400

An order is paid by the callback, by check-payment, or at checkout when its total is Rp0. Payment grants class enrolments and digital-product access (bundles expanded), removes the items from the cart, and credits each merchant's wallet with the item price minus its code discounts. Income becomes withdrawable on Duitku's settlement date (H+4, Asia/Jakarta, when none is reported, which is always the case after check-payment). Overdue unpaid orders are marked `expired` every minute; settlement runs every 30 minutes.

Deployment needs the six `PAYMENT_*` variables in `.env.example`. `PAYMENT_GATEWAY_URL` is the POP API base (`https://api-sandbox.duitku.com/api` or `https://api-prod.duitku.com/api`), not the demo page; `PAYMENT_GATEWAY_STATUS_URL` is the full `transactionStatus` URL, on another host (see `.env.example`). Until all six are set, paid checkout, check-payment and the callback answer 503. The return page receives `?order_id=<order id>`. The callback and return URLs are sent with every invoice, so nothing has to be registered in the Duitku dashboard; `PAYMENT_CALLBACK_URL` must be public on port 80 or 443, and Cloudflare must let Duitku's POSTs to `/api/v1/payments/duitku/callback` through (no bot challenge on that path).

### Merchant profile and settings

- `POST /api/v1/merchant/register` — the registration form, all required: `store_name`, `store_description`, `terms_accepted` (must be `true`; stored as `terms_accepted_at`), `business_type` (Jenis Merchant: `individual`, `institution`, `company`), `category_label` (Bidang Utama as a merchant category: Teknik & Engineering → `Teknik & Arsitektur`, Teknologi & Pemrograman → `Pemrograman & IT`, `Desain & Kreatif`, `Bisnis & Manajemen`; `null` or omitted for Lainnya), `city` (Kota Operasional), `public_phone` (Nomor WhatsApp Bisnis, shown on the storefront) and `product_types` (one to three of `kelas`, `bootcamp`, `digital`; repeats collapse, returned in that order); the store starts at Basic; 409 when the user already has a store
- `GET /api/v1/merchants/:merchant` — **public** storefront by id or slug; stats, skills (Bidang), landing settings, and `is_owner` for the signed-in owner
- `GET /api/v1/merchant/profile` — includes `level` (see Merchant levels) and the registration answers `business_type` and `product_types` (`null` for stores registered before the form asked for them)
- `PATCH /api/v1/merchant/profile` — includes logo (`avatar_asset_id`), banner (`cover_asset_id`), sanitized rich-text description, skills (up to 20; replaces the list), and landing background (`landing_background_asset_id`) and layout (`landing_layout`; `null` resets it); `business_type` and `product_types` can be changed (not cleared); `terms_accepted_at` is read-only
- `GET /api/v1/merchant/notification-preferences`
- `PATCH /api/v1/merchant/notification-preferences`

### Merchant levels

Each store is Basic, Silver or Gold by its monthly revenue (net of paid sales, Asia/Jakarta months): Silver from Rp 2,500,000 and Gold from Rp 5,000,000. A daily job (00:30 WIB) evaluates the month that ended, once per store:
- a store moves up straight to the level the month reaches (Basic can jump to Gold); a Gold month under Rp 5,000,000 makes it Silver, however low the month is; Silver drops to Basic only after two consecutive months under Rp 2,500,000 (counting the month before, whatever its level), so two very low months take Gold to Silver and then Basic;
- a store with non-deleted items (drafts included) and no paid sale in two consecutive counted months gets a warning; a further month without a sale soft-deletes its digital products, classes, bootcamps and bundles, ends buyers' access to them and deactivates its discounts and vouchers. Counted months are full months after tracking started (registration, or deploy for older stores) and after any earlier removal;
- every evaluation writes `notifications` rows for the owner (`merchant_level_evaluated`, plus `merchant_inactivity_warning` or `merchant_items_removed`) for an external email sender; this API neither sends nor lists them (`level.inactivity_warning` shows a warning).

Per-file upload limit by level: 1, 5 or 10 GB for class materials, class videos, assignment attachments and digital-product files, checked when the file is attached; a Pro store has no per-file limit (see Pintar Pintar Pro). Storage quota by level: 30, 100 or 200 GB, counting each distinct file attached to the store's non-deleted (drafts included) class materials, class videos, assignment attachments and digital-product files (covers, logos and profile images do not count). Attaching a file that would pass the quota is refused with 400; removing an item frees its space (the stored object is kept); a store over its quota after a level drop keeps its files but cannot add new ones. `level.storage_used_bytes` shows the current use.

- `GET /api/v1/merchant/level-evaluations` — the store's monthly evaluations, newest first

### Pintar Pintar Pro

Pro is for merchants. Each store's Pro time is a list of periods (`merchant_pro_periods`); a store is Pro while an `active` period covers now, so Pro ends by itself at the end date. Plans (`pro_plans`: duration in months and price) are rows set by the platform team; none exist yet, and buying Pro is not implemented yet. While Pro, the store's content files have no per-file limit; the storage quota still applies, image caps stay, and files attached while Pro stay after it ends.

- `GET /api/v1/pro-plans` — **public**; the offered plans (empty until plans exist)
- `GET /api/v1/merchant/pro-subscription` — `is_pro`, `pro_until` (end of the Pro time continuing from now), the current period, upcoming periods and past or cancelled periods
- `GET /api/v1/profile` and `GET /api/v1/merchant/profile` also return `is_pro` and `pro_until`

### Merchant dashboard

- `GET /api/v1/merchant/dashboard` — summary and `level` (see Merchant levels); rating and latest review cover class and digital-product reviews; activity lists the 10 newest enrolments, reviews and digital or bundle purchases. `period_days` is 7, 30 (default), 90 or 365: N covers today and the N − 1 days before it (Asia/Jakarta), compared with the N days before that. Revenue, transactions and the chart follow the Analitik rules; `students` counts distinct buyers of paid orders
- `GET /api/v1/merchant/sales` — price (`amount`), net after the item's share of the voucher and discount code (`net_amount`), and payment method per item (`payment_method` code and readable `payment_method_label`, as in the order detail); revenue figures across the dashboard use the net
- `GET /api/v1/merchant/sales/export` — the filtered sales as JSON `rows` (up to 5,000, `truncated` when there are more) for the page to save as a spreadsheet; same filters as the list
- `GET /api/v1/merchant/customers`
- `GET /api/v1/merchant/wallet` — `earning_balance`, `settled_balance` (withdrawable), `clearing_balance` (not yet settled), `lifetime_earnings` and `total_withdrawn`
- `GET /api/v1/merchant/balance-history`
- `POST /api/v1/merchant/withdrawals` — "Tarik Saldo": `amount` (minimum Rp100.000) from the settled balance, to the primary account or a chosen `payout_account_id`; the Rp5.000 fee comes out of the amount (`transfer_amount`); the amount leaves the balance at once and is transferred manually

### Merchant analytics (Analitik)

Asia/Jakarta days; paid orders only, dated at payment (at order time when no payment time is stored); revenue is the merchant's net, as on the dashboard; a transaction is a paid order with the merchant's items. Student growth counts class enrolments instead.

Daily transactions and revenue are stored per merchant and day in `merchant_daily_stats`: every start rebuilds it, and a job refreshes the last 7 closed days every 10 minutes. Daily sales, monthly revenue, the dashboard revenue, transactions and chart, the level's `current_month_revenue` and the level evaluation read the stored days before yesterday and compute yesterday and today from the orders, so they never wait for the job.

- `GET /api/v1/merchant/analytics/student-growth` — `from`, `to` (YYYY-MM-DD), optional `granularity` (`day`/`month`/`year`; by default daily within a month, monthly within a year, otherwise yearly); running total of distinct class students, including those enrolled before `from` (a person counts once; digital products excluded); at most 400 points and 10 years; `from` after `to`, or a longer range, is a 400
- `GET /api/v1/merchant/analytics/daily-sales` — `month` (YYYY-MM, default the current Asia/Jakarta month); transactions and revenue for every day, plus totals
- `GET /api/v1/merchant/analytics/monthly-revenue` — `year` (2000–2100, default the current Asia/Jakarta year); revenue for each month, plus the year total
- `GET /api/v1/merchant/analytics/summary` — `period` (`today`/`month`/`year`, default `month`); conversion (buyers ÷ distinct visitors, at most 100%, null without visits), retention (buyers with another purchase from the merchant in the previous 90 days), and average order value, each compared with the same elapsed span of the previous period
- `POST /api/v1/analytics/visits` — **public**; `{target_type: storefront|kelas|bootcamp|digital|bundle, target_id, visitor_id}` from the storefront and detail pages; `visitor_id` is needed only without a login token; a storefront `target_id` is the merchant id or slug, and an unknown or hidden page is 404; one visit per merchant, visitor, and day (a login makes the user the visitor); the merchant's own visits and bots are ignored; 60 per minute per client

### Merchant payout accounts (Rekening)

Account numbers are always returned masked. They are stored encrypted when `PAYOUT_ACCOUNT_ENCRYPTION_KEY` is set, and as plain text otherwise. `bank_name` is Bank BCA, Bank Mandiri, Bank BNI, Bank BRI or Bank Syariah Indonesia (BSI); `account_number` is 6–20 digits (spaces and dashes are removed).

- `POST /api/v1/merchant/payout-accounts` — optional `is_primary`; the first account is always primary
- `GET /api/v1/merchant/payout-accounts`
- `PATCH /api/v1/merchant/payout-accounts/:id` — `is_primary: true` makes it the primary account (`false` on the primary is a 400); changing the bank, holder or number resets the verification
- `POST /api/v1/merchant/payout-accounts/:id/set-primary`
- `DELETE /api/v1/merchant/payout-accounts/:id` — deleting the primary makes the oldest remaining account primary

### Merchant discounts

- `GET /api/v1/merchant/discounts/eligible-items` — with `price`, `image_url` and `is_available`
- `POST /api/v1/merchant/discounts` — codes are system-generated: a `once` entry of N creates N single-use codes ("Kode Sekali Pakai", at most 1,000 per request); a `recurring` entry creates one code shared up to its limit, usable once per user ("Kode Berulang"). An expired, failed or cancelled order gives its code use back. `percentage` (up to 100) or `nominal`; `starts_at` before `ends_at`; no `targets` means every item of the store
- `GET /api/v1/merchant/discounts` — `status` is `inactive`, `scheduled`, `active`, `expired` or `limit_reached` (every code used up)
- `GET /api/v1/merchant/discounts/:id`
- `PATCH /api/v1/merchant/discounts/:id`
- `POST /api/v1/merchant/discounts/:id/codes`
- `POST /api/v1/merchant/discounts/:id/remove-codes` — `{code_ids}` (up to 1,000) removes those codes at once and returns the discount; an id of another discount is a 400 and nothing changes
- `DELETE /api/v1/merchant/discount-codes/:codeId`
- `DELETE /api/v1/merchant/discounts/:id`

### Covers (classes, bootcamps, digital products, bundles)

Each item has up to 5 ordered covers; the first is the main cover, returned as `cover_asset_id` / `cover_url` and used on cards. Create and update take `cover_asset_ids` (the whole ordered list; `[]` removes all) or the single `cover_asset_id` (sets the main cover and keeps the others; `null` removes the main cover), never both. Details, the merchant lists and the public bundle list return `covers: [{ asset_id, url }]`.

### Merchant bundles

- `GET /api/v1/merchant/bundles/eligible-items`
- `POST /api/v1/merchant/bundles` — 2–20 distinct items, each `{id}` (`type` optional); `price` above 0 and below the items' total; a bundle without `status` starts `unpublished`, and `published` or `unlisted` needs every item available
- `GET /api/v1/merchant/bundles`
- `GET /api/v1/merchant/bundles/:id`
- `PATCH /api/v1/merchant/bundles/:id`
- `DELETE /api/v1/merchant/bundles/:id`
- `GET /api/v1/bundles` — **public**; published bundles of active merchants, optionally of one merchant (`merchant_id`)

### Merchant digital products

- `GET /api/v1/merchant/digital-products` — own products with downloads, rating, and revenue; filter by `status` (`published`, `unpublished`, `unlisted`) and `search`
- `GET /api/v1/merchant/digital-products/:id` — includes a signed download link for the product file
- `POST /api/v1/merchant/digital-products` — `category_slug` (`pdf`, `template`, `e-book`, `project-files`, `template-canva`, `excel`, `desain-grafis`, `videografi`, `lainnya`, or a sub-category such as `photoshop` or `video-effect`; the tree is `GET /api/v1/catalog/categories`), prices (`discount_price` at most `original_price`), status (default `unpublished`), covers, one file (required for `published`; any type with an extension except programs, scripts, installers and web pages such as EXE, BAT, APK or HTML; its extension becomes `file_format`, e.g. `RVT`), post-purchase instructions
- `PATCH /api/v1/merchant/digital-products/:id` — a new `file_asset_id` replaces the single file
- `DELETE /api/v1/merchant/digital-products/:id` — 409 while the product is in a published or unlisted bundle; buyers keep access

### Merchant classes and class management

The class owner has full access. Assigned tutors (`lead`, `assistant`, `moderator`) act within their permission matrix (areas `materi`, `meeting`, `tugas`, `nilai`, `sertifikat` × `lihat`, `tambah`, `edit`, `delete`): a missing permission or an owner-only action is 403, anyone else gets 404 (inviting a tutor is 404 for everyone but the owner). Class status `archived` means unlisted (hidden from lists, open by link). Writes return `{data, responseMessage}`; deletes return 204.

- `GET /api/v1/merchant/classes` — the signed-in owner's store; filter by `status` and `type`; `limit` up to 100
- `POST /api/v1/merchant/classes` — requires Kategori Skill (`skill_category`: the label of the form's selector, 1–64 characters, trimmed; the FE owns the options); also accepts Bidang (`category`: Coding/Elektro/Mesin/Desain/Sipil/Kimia), `level` (Pemula/Menengah/Mahir), `duration`, `prerequisites`, and `learning_outcomes` (up to 20); `PATCH /api/v1/classes/:classId` updates them (`skill_category` can be changed but not cleared; classes created before it have `null`). Class responses, catalog cards and the home carousels return `skill_category`
- `GET /api/v1/classes/:classId`
- `PATCH /api/v1/classes/:classId` — details, prices, covers, post-purchase instructions; a lead tutor may change everything except `type`, `status` and prices; other tutors get 403
- `POST /api/v1/classes/:classId/duplicate` — owner only; `{type}`; a draft "(Salinan)" copy with details, prices, covers, syllabus, assignments (with their questions and original due dates), certificate settings, and FAQ (no learners, reviews, discussions, submissions, certificates, tutors, or meetings)
- `GET /api/v1/classes/:classId/faqs`, `POST /api/v1/classes/:classId/faqs` — `materi` permission; question up to 300, answer up to 3000 characters; at most 50 per class
- `PATCH /api/v1/classes/:classId/faqs/:faqId`, `DELETE /api/v1/classes/:classId/faqs/:faqId`
- `GET /api/v1/classes/:classId/chapters` — `materi.lihat`; chapters with `videos` and `files` (resources) in order; uploaded files carry signed download links. Without `limit` it returns every chapter (the bab reorder needs them all); with `limit` it paginates
- `POST /api/v1/classes/:classId/chapters` — a new bab goes last unless `order` is sent
- `PATCH /api/v1/classes/:classId/chapters/:chapterId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId` — also removes its videos and resources; progress and automatic certificates are re-evaluated
- `PUT /api/v1/classes/:classId/chapters/order` — `materi.edit`; the complete `chapter_ids` list in the new bab order (400 otherwise); returns the reordered chapters
- `PUT /api/v1/classes/:classId/chapters/:chapterId/order` — complete `video_ids` and `resource_ids` lists (`[]` when there are none)
- `POST /api/v1/classes/:classId/chapters/:chapterId/videos` — a link video (an https `youtube_url`; other video links are accepted too) or a file video (`asset_id` of an uploaded MP4/MOV/WebM, within the store level's per-file limit); `source` is inferred from the field sent
- `PATCH /api/v1/classes/:classId/chapters/:chapterId/videos/:videoId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId/videos/:videoId`
- `POST /api/v1/classes/:classId/chapters/:chapterId/resources` — `resources`: 1–20 materials, each a `name` with an uploaded `asset_id` or an https `url`; `type` (`pdf`, `archive`, `image`, `file`, `link`) is derived from the file or the link, whatever is sent; `data` is the array of added materials
- `PATCH /api/v1/classes/:classId/chapters/:chapterId/resources/:resourceId` — `url` can change only on a link material
- `DELETE /api/v1/classes/:classId/chapters/:chapterId/resources/:resourceId`
- `GET /api/v1/classes/:classId/meetings` — `meeting.lihat`
- `POST /api/v1/classes/:classId/meetings` — `meeting.tambah`; live bootcamps only (400 for video classes); `title`, date `YYYY-MM-DD`, time `HH:mm` (Asia/Jakarta), optional https `live_url`, `duration_minutes` (1–1440) and `mentor_id` (the `mentor_id` of an active tutor of the class)
- `PATCH /api/v1/classes/:classId/meetings/:meetingId` — `meeting.edit`; `null` clears the content, link, duration and mentor
- `DELETE /api/v1/classes/:classId/meetings/:meetingId` — `meeting.delete`; soft delete; its attendance stops counting and automatic certificates are re-evaluated

Meeting responses include `duration_minutes` and `mentor {id, name}`. `status` is `upcoming` until the start plus the duration (180 minutes when unset) has passed, then `completed`. A live bootcamp that has meetings cannot become a video class.
- `GET /api/v1/classes/:classId/mentors` — tutors with name, email, avatar, role, and permissions
- `POST /api/v1/classes/:classId/mentors` — owner only; invite an active mentor account by email with a role; the role preset applies when no matrix is sent (a sent matrix's missing entries are `false`); 409 when already assigned
- `PATCH /api/v1/classes/:classId/mentors/:classMentorId` — owner only
- `DELETE /api/v1/classes/:classId/mentors/:classMentorId` — owner only; the tutor loses access immediately
- `GET /api/v1/classes/:classId/students`
- `GET /api/v1/classes/:classId/assignments` — any tutor of the class; submission counts; correct answers only for the owner and tutors with a `tugas` or `nilai` permission
- `POST /api/v1/classes/:classId/assignments` — `tugas.tambah`; future `due`, `file_upload` or `quiz` (1–100 `multiple_choice` or `essay` questions, 2–4 options per multiple-choice question), an optional attached file
- `PATCH /api/v1/classes/:classId/assignments/:assignmentId` — `tugas.edit`; any field of the create body; submissions are kept, and once there are submissions the type and the quiz questions cannot change (409)
- `DELETE /api/v1/classes/:classId/assignments/:assignmentId` — `tugas.delete`; its scores leave the averages, and automatic certificates are re-evaluated
- `GET /api/v1/classes/:classId/assignments/:assignmentId/submissions` — `nilai.lihat`; latest submission per learner with file link and answers
- `PATCH /api/v1/classes/:classId/submissions/:submissionId/grade` — `nilai.edit`; a file `score` 0–100, or quiz `essay_scores` up to each question's weight (the quiz score appears once every essay is scored); `feedback`
- `GET /api/v1/classes/:classId/grades` — `nilai.lihat`; scores per learner and assignment, learner and class averages
- `GET /api/v1/classes/:classId/attendance-summary` — `meeting.lihat`
- `GET /api/v1/classes/:classId/meetings/:meetingId/attendances` — `meeting.lihat`; no record counts as `alpa`
- `PATCH /api/v1/classes/:classId/meetings/:meetingId/attendances/:userId` — `meeting.edit`; `hadir`, `izin` or `alpa`
- `GET /api/v1/classes/:classId/certificate-settings` — `sertifikat.lihat`; defaults: manual, attendance 80, score 75
- `PATCH /api/v1/classes/:classId/certificate-settings` — `sertifikat.edit`; `auto_issue`, `min_attendance_percent`, `min_score` (0–100); saving in automatic mode issues every eligible learner's certificate
- `GET /api/v1/classes/:classId/certificates` — `sertifikat.lihat`; status `issued`, `pending` (eligible, not issued) or `ineligible` per learner, with `graded_assignments` and `assignment_count`. Eligible means 100% progress, the minimum attendance once meetings have started, and a graded submission for every assignment with an average at least the minimum score; an issued certificate stays when an assignment is added later
- `POST /api/v1/classes/:classId/certificates/:userId/issue` — `sertifikat.tambah`; eligible learners only (400 otherwise, 409 when already issued); numbers `PP-CERT-YYYY-NNNN` (Asia/Jakarta year, never reused)
- `PUT /api/v1/classes/:classId/certificates/:userId/file` — `sertifikat.edit`; an uploaded PDF, PNG or JPG
- `DELETE /api/v1/classes/:classId/certificates/:userId` — `sertifikat.delete`; withdraws the certificate

A learner is eligible with 100% progress, attendance at the minimum once the class has a started meeting, and, when the class has assignments, an average of graded scores at the minimum. In automatic mode the certificate is issued as soon as a learner becomes eligible: when a video is completed, a submission is graded, a quiz with only multiple-choice questions is submitted, attendance is recorded, the settings are saved, a video is added or removed (also with its bab), or a meeting or an assignment is deleted.

### Learning (enrolled learners and buyers)

Every route that needs a login requires an active enrollment or product access and answers 404 otherwise; the two `attendance` routes are public.

- `GET /api/v1/learning/classes/:id` — `post_purchase_instructions`, chapters, videos (`source`; YouTube id, or a signed `video_url` for file videos; completion), files (a signed `download_url`, or the `url` of a link), meetings with live links and `my_attendance_status`, FAQ (`faqs`), progress, next video, certificate
- `POST /api/v1/learning/videos/:videoId/complete` — idempotent; returns progress and the next video
- `GET /api/v1/learning/classes/:classId/assignments` — without answer keys; own latest submission
- `GET /api/v1/learning/assignments/:assignmentId/quiz`
- `POST /api/v1/learning/assignments/:assignmentId/submit` — `file_asset_id` of an own upload (any type with an extension except programs, scripts, installers and web pages; 500 MB); replaces before the due time (clearing the grade); a late first submission is accepted, a late change is 409
- `POST /api/v1/learning/assignments/:assignmentId/submit-quiz` — every question answered once; multiple choice is scored at once and essays wait for a tutor; a quiz with only multiple-choice questions is graded on submission, and in automatic mode an eligible learner gets the certificate at once
- `GET /api/v1/learning/classes/:classId/grades` — scores, feedback, Partisipasi and average
- `GET /api/v1/learning/meetings/:meetingId` — the check-in page (`/absensi`)
- `POST /api/v1/learning/meetings/:meetingId/check-in` — after the start; identity from the account (`name` or `email` is a 400); optional `feedback`
- `GET /api/v1/attendance/classes/:classId` — **public** attendance page (`/absensi/{classId}`): class, merchant, mentors, and the latest started meeting (or the next one); never the meeting link
- `POST /api/v1/attendance/classes/:classId/check-in` — **public**; `{name, email, feedback?}`; the email must belong to a learner enrolled in the class; checks in to the latest started meeting; 10 per 10 minutes per client
- `GET /api/v1/learning/digital-products/:id` — owned product with a signed download, also after the merchant deletes it

### File upload (S3 multipart)

- `POST /api/v1/upload/initiate`
- `POST /api/v1/upload/presigned-urls`
- `POST /api/v1/upload/complete` — `parts` lists each `ETag` with its `PartNumber` (an integer from 1 to 10,000); also registers the file and returns its `asset_id`; send it in the form field the file is for. The field checks the file when the form is saved: covers, logos, banners, landing backgrounds and the user photo take PNG/JPG/WebP images (2 MB for logo and photo, otherwise 4 MB) and make the file public; class materials, assignment attachments and digital-product files (any type with an extension except programs, scripts, installers and web pages such as EXE, BAT, APK or HTML), class videos (MP4/MOV/WebM) (each up to the store level's per-file limit: 1, 5 or 10 GB, and within its storage quota), submissions (the same block list, 500 MB), certificate files (PDF/PNG/JPG, 10 MB) and CVs (PDF/DOC/DOCX, 10 MB) make it private. A file used in a public field cannot go into a private one, or the reverse. Each field's accepted types and size are in its Swagger description, and a rejected file gets a plain message such as "The file must be 2 MB or smaller" or "Allowed file types: PDF, DWG or ZIP". Private files are only served through signed links that expire after 10 minutes. The file must be the caller's own finished upload: presigning or completing another user's key is a 403. `partsCount` is 1–10,000, and part upload URLs last 1 hour. The type is judged from the file extension and the `contentType` sent to initiate

### Mentor

- `POST /api/v1/mentor/register` — the mentor fields plus `cv_asset_id` (PDF, DOC or DOCX, 10 MB) and `skill_certificate_asset_id` (PDF, PNG or JPG, 10 MB), two different uploads of the caller; a new mentor signs up as a user first; also completes the mentor record of an accepted job applicant
- `GET /api/v1/mentors/:id` — **public**; `:id` is the mentor id (`mentor_id`); only active mentors with a completed registration
- `GET /api/v1/mentor/profile` — also for a mentor hired through a job posting before the registration: `registration_complete` is false and the professional fields and documents are null until `POST /api/v1/mentor/register` completes the record
- `PATCH /api/v1/mentor/profile` — 404 until the registration is complete
- `GET /api/v1/mentor/assignments` — merchant, product, and class tutor assignments (with role and permissions)
- `GET /api/v1/mentor/dashboard` — stats, upcoming sessions, recent learner messages, class progress
- `GET /api/v1/mentor/classes` — assigned classes (Kelas-kelas) with `cover_url`, filterable by type and search
- `GET /api/v1/mentor/teaching-history` — teaching history (Kelas Mentor on the profile)
- `GET /api/v1/mentor/documents` — CV and skill certificate with download URLs that expire after 10 minutes
- `PATCH /api/v1/mentor/documents` — `cv_asset_id` and/or `skill_certificate_asset_id`; the previous files are kept

### Karir (job board and mentor recruitment)

Merchants publish teaching vacancies; any logged-in user except the vacancy's merchant applies once per vacancy. Statuses: `review` → `interview` → `accepted` or `rejected` (a rejected applicant can still be accepted; acceptance is final). Accepting makes the applicant an active mentor (`is_mentor`), adds them to the merchant's mentor list, and, when the vacancy has a class, assigns them as its `assistant` tutor.

- `GET /api/v1/job-postings` — **public**; active vacancies of active merchants with `search` (title, merchant, category, skills), `location`, `category`, `contract_type`, `work_type`, paging, applicant counts, `is_new` (7 days), and the board totals
- `GET /api/v1/job-postings/:id` — **public**; 404 once closed or while the merchant is inactive
- Job responses carry `is_saved`: true when the signed-in caller saved the job, false without a token (the board and detail stay public)
- `GET /api/v1/job-postings/saved` — the caller's saved jobs ("Lowongan Tersimpan"), newest save first, paginated; each has the job fields plus `saved_at` and `is_open` (false once closed or removed; it stays listed until unsaved)
- `PUT /api/v1/job-postings/:id/save` — save an active job; saving again is a no-op; 404 for a closed or unknown job
- `DELETE /api/v1/job-postings/:id/save` — unsave; also succeeds when it was not saved
- `POST /api/v1/merchant/job-postings` — active merchants only; category is one of the 5 form labels, `Part-Time`/`Full-Time`, `Remote`/`Hybrid`/`On-Site`, free-text salary, up to 20 skills, optional own `class_id`
- `GET /api/v1/merchant/job-postings` — own active vacancies
- `GET /api/v1/merchant/job-postings/:id`
- `PATCH /api/v1/merchant/job-postings/:id` — `class_id: null` unlinks the class; closed vacancies cannot be edited
- `POST /api/v1/merchant/job-postings/:id/close` — permanent; applications are kept
- `POST /api/v1/job-postings/:jobId/apply` — name, email, WhatsApp, LinkedIn, `cv_asset_id` (an uploaded PDF/DOC/DOCX up to 10 MB, or the applicant's mentor CV), optional note; 409 on a second application
- `GET /api/v1/job-applications` — Progress Lamaran; `status` filter, paginated; counts per status
- `GET /api/v1/merchant/job-applications` — filter by `job_id`, `status`, `search`; counts per status; `mentor_id` when the applicant is a mentor
- `GET /api/v1/merchant/job-applications/:id/cv` — signed CV link (10 minutes)
- `POST /api/v1/merchant/job-applications/:id/schedule-interview` — `interview_at` (ISO 8601 with offset) and `interview_url`; rescheduling replaces both
- `POST /api/v1/merchant/job-applications/:id/accept`
- `POST /api/v1/merchant/job-applications/:id/reject`
- `GET /api/v1/merchant/mentors` — accepted applicants plus the tutors of the merchant's classes, with `mentor_id`, class counts and ratings, and the page summary
- `GET /api/v1/merchant/mentors/:userId` — the mentor's classes with students, ratings, and review counts

### Automatic emails

The backend emails users when these events happen. Every email has an HTML part and a plain-text part, in Indonesian (placeholder wording), with times in WIB and amounts in Rupiah:

| Email | To | When |
|---|---|---|
| Menunggu pembayaran | buyer | a paid order's Duitku invoice is created (payment link and deadline) |
| Pembayaran berhasil | buyer | the order is paid, including free orders; lists the items and each item's `post_purchase_instructions` |
| Pesanan kedaluwarsa / Pembayaran gagal | buyer | the 60-minute expiry closes the order / Duitku reports a failure |
| Penjualan baru | each merchant in the order | the order is paid, unless the merchant turned `email_new_sale` off; only its own items and net amounts |
| Laporan mingguan | merchant | Mondays from 08.00 WIB (hourly until 23.00, once per store and week), for the Monday–Sunday that ended: net income and change vs the week before, transactions, buyers, top 3 items, new reviews and average, withdrawable balance (dashboard figures); unless `email_weekly_report` is off or the week had no sale and no review |
| Hasil level, Peringatan, Produk dihapus | merchant | each monthly level evaluation, inactivity warning and removal |
| Penarikan saldo diajukan | merchant | a withdrawal request |
| Rekening pencairan diubah | merchant | a payout account is added, changed, deleted or made primary (masked number) |
| Atur ulang kata sandi | user | a password reset request (link valid 60 minutes; the token is removed from the stored email once sent) |
| Kata sandi diubah | user | a password change or a reset |
| Lamaran: terkirim, jadwal wawancara, diterima, belum diterima | applicant (the application's email) | apply, schedule or reschedule an interview, accept, reject |
| Jadwal sesi baru / diubah / dibatalkan | enrolled learners | a bootcamp meeting is created; its date, time, duration or link changes; or it is deleted |
| Sesi dimulai 1 jam lagi / Kamu mengajar 1 jam lagi | enrolled learners / the meeting's mentor | a job every 5 minutes, for bootcamp meetings starting in more than 10 and at most 60 minutes; once per recipient and start time (a moved meeting is reminded again); a user who is both gets the mentor email |
| Tugas dinilai | learner | a submission is graded |
| Sertifikat terbit | learner | a certificate is issued, manually or automatically |

How sending works:
- Each email is written to the `email_outbox` table in the event's own transaction, under a savepoint, so an email problem never fails the event. A deduplication key per event means a repeated Duitku callback or job never queues it twice.
- A background job sends due emails every 30 seconds. A temporary SMTP failure (connection, login, 4xx) is retried after 1, 5, 15, 60 and 360 minutes; a permanent rejection (5xx for the recipient or message) or a sixth failure marks it `failed`.
- Each email expires 3 days after it was queued; an awaiting-payment email at its payment deadline and a meeting email when the meeting starts. Expired emails are `discarded`, not sent late. Sent, failed and discarded rows are deleted after 90 days.
- Until `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` and `MAIL_SENDER` are all set, nothing is sent and the app logs one warning naming the missing variables; emails keep waiting until they expire.
- Links and the logo point to `https://pintarpintar.id`. `FRONTEND_URL` overrides that for another environment; a value that is not an http(s) URL is ignored with one warning.
- Templates live in `src/api/email/templates/`, one file per email; the wording can change there without touching the logic.
- The SQL log never shows the parameters of statements on `email_outbox` or `password_reset_tokens` (`[redacted]`), so queued payloads and reset tokens stay out of the logs.

### Class discussions

Open to the class's merchant owner, its active assigned mentors, and enrolled learners (anyone else gets 404); learners can reply but not start threads (403).

- `GET /api/v1/discussions/threads` — `class_id` query parameter (required); paginated, newest first; each thread carries all its comments
- `POST /api/v1/discussions/threads` — `badge` defaults to `Tanya Jawab`
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

**Database log.** With `NODE_ENV=production` (the Docker image's runtime stage), the log never shows SQL parameter values. It shows:
- failed statements, with the SQLSTATE code and the constraint, table or column (not the message, which can quote values);
- statements slower than 400 ms, with their duration;
- TypeORM warnings and migration runs.

Successful statements are not logged. In development every statement is logged with its values, except that statements on `email_outbox` and `password_reset_tokens` show `[redacted]`. Traces carry statement text but no values.

**Error log.** Every error response is one line from the `HTTP` logger: `<status> <METHOD> <path>`, without the query string, request body or headers.
- A 4xx is a warning with the message the client received, without a stack.
- A 5xx is an error with its stack. In production a database error shows its SQLSTATE code and constraint or table instead of the database message, which can quote values.

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

Every variable the running application uses is listed in `.env.example` (Compose also takes optional `LOCAL_JAEGER_*` ports).

**Required:**
- `DB_*`.
- `JWT_ADMIN_KEY`: the application refuses to start without it. Changing it signs every user out.
- The S3 settings (`AWS_*`) for uploads and private files.
- `ASSET_PUBLIC_BASE_URL`: responses carry image URLs only (no storage keys), so without it every avatar and cover is `null`; the application logs an error at startup when it is missing.
- The six `PAYMENT_*` settings, or paid checkout answers 503.

**Optional:**
- `PAYOUT_ACCOUNT_ENCRYPTION_KEY`: never change or remove it once used.
- `JWT_EXPIRES`: token lifetime (default `30d`).
- `NODE_ENV`: `production` limits the database log to failures, slow statements (over 400 ms), warnings and migrations, without parameter values (see Observability); it is also the traces' environment name. The Docker image sets it.
- The `OTEL_*` tracing settings. Tracing is on by default and exports to `http://localhost:4318/v1/traces`; set `OTEL_ENABLED=false` (or `OTEL_SDK_DISABLED=true`) to turn it off.
- `ENV_FILE`, which selects the env file (default `.env`).
- The five email settings (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SENDER`): without them the app runs and emails wait in the queue (see Automatic emails). `FRONTEND_URL` is optional (default `https://pintarpintar.id`). When the login mailbox differs from the sender address (for example `mail@` sending as `info@`), the mail server must allow it, for example as an alias. Deliverability also needs the sending domain's SPF, DKIM and DMARC records and the server's reverse DNS.
- `REDIS_*` is not used: Redis is not wired into the application.

**Deploy steps:**
1. Before the first deploy to a database that does not yet have `1790840000000-restore-schema-integrity`, run that migration's read-only precondition check against it (`preconditions.sql` of the archived `restore-shared-schema-integrity` OpenSpec change, kept in the local OpenSpec workspace, not in this repository). Pending migrations then run automatically at startup (`migrationsRun: true`), and a migration whose guard fails stops the startup with its message.
2. Duitku posts payment notifications to `PAYMENT_CALLBACK_URL`, which must be `https://<api-host>/api/v1/payments/duitku/callback`. It must be public on port 80 or 443, and Cloudflare must let `POST /api/v1/payments/duitku/callback` through without a bot challenge. Unpaid orders expire every minute, and settlement runs every 30 minutes.
3. Withdrawals are processed manually:
   - after transferring, set the payout's `status` to `success`;
   - when a transfer fails, set it to `failed` and add the amount back to the merchant wallet's `earning_balance` and `settled_balance`.

## License

Nest is [MIT licensed](LICENSE).
