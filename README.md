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

Responses are `{data, responseMessage}`. Paginated lists take `page` (default 1) and `limit` (default 10, at most 100; the promo lists at most 6). A blank or non-numeric value means the default and an out-of-range value is clamped to the nearest bound, so paging never fails a request. They return `meta: {page, limit, total, total_page}` next to `data`, also when the list sits inside an object (job board, applications, class grades, reviews). Errors are `{statusCode, error, responseMessage, errors?}`: `error` is the status name (`BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, …), `responseMessage` is one message in plain words, and a validation failure also lists every reason in `errors`. Some errors add a `details` object, for example the pending `order_id` of the "awaiting payment" 409. Every stored image in a response comes with a ready `*_url` (`image_url`, `cover_url`, `avatar_url`, …), `null` without an image, so the client never needs the storage base URL; responses carry no storage object keys.

Request fields follow the same rules everywhere. An optional text field is cleared with `""` or `null`; a field the data needs (a title, a name, a mentor's phone) rejects `""`, whitespace and `null`. Text is trimmed. Choice values (`type`, `status`, `level`, `badge`, sort values) match ignoring case and surrounding spaces and are stored in their canonical spelling. Numbers may be sent as numeric strings, and a blank optional number means "not sent". A blank query filter (`?search=`, `?category=`, `?status=`) means no filter. Wherever an item id is sent (cart, wishlist, checkout, bundle items, discount targets), `type` is optional: the server resolves it from the id, and a sent `type` only has to name the right family (`kelas` and `bootcamp` both accept any class).

Naming is the same everywhere: fields are snake_case (the envelope keys `responseMessage` and `statusCode`, and the S3 upload and Duitku callback bodies, are the documented exceptions), and an item kind is always `kelas` (video class), `bootcamp`, `digital` or `bundle`. Prices are `price`, `original_price`, `discount_price`, `discount_amount` and `discount_percent`; discounts and vouchers share `minimum_purchase`, `starts_at`, `ends_at`, `usage_limit` and `used_count`. Lists search with `search` and order with `sort_by` and `sort_order` (`asc`/`desc`). A request body or query field the endpoint does not define — a typo or an old name — is a 400 naming it (the Duitku callback ignores the extra fields Duitku sends).

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

The catalog keeps accepting `type=kelas-live` (the "Kelas Live" filter) and returns no items until that kind exists (PM item 21).

### Authentication and user

- `POST /api/v1/auth/sign-up` — **public**; `data: {token, user}` (`user` as in `GET /api/v1/users/me`)
- `POST /api/v1/auth/sign-in` — **public**; `data: {token, user}`; a wrong email or password is 403
- `PATCH /api/v1/auth/password` — current password required; other devices are signed out; `data.token` replaces this device's token
- `POST /api/v1/auth/end-other-sessions` — signs out every other device; `data.token` replaces this device's token
- `GET /api/v1/users/me` — `{data, responseMessage}` like every other route
- `PATCH /api/v1/users/me` — returns the same user object as `GET`
- `DELETE /api/v1/users/me` — returns the account as it was; frees the email for a new sign-up and deactivates the user's merchant (buyers keep access)

### Beranda (home)

- `GET /api/v1/home/statistics` — **public**; active learners, published classes and digital products, platform rating
- `GET /api/v1/home/bootcamps` — **public**
- `GET /api/v1/home/video-classes` — **public**
- `GET /api/v1/home/digital-products` — **public**
- `GET /api/v1/home/merchants` — **public**
- `GET /api/v1/home/testimonials` — **public**; well-rated class reviews

### Catalog (Kelas, Bootcamp, Produk Digital)

- `GET /api/v1/catalog/items` — **public**; filter by type, search (title, merchant name, category name, file format), level, category (slug or name), merchant (`merchant_id`), and digital file type (`file_format`); `sort_by` + `sort_order`; paginate; with a login token each card has `in_wishlist` (also on the home and promo cards)
- `GET /api/v1/catalog/categories` — **public**; category tree
- `GET /api/v1/catalog/classes/:id` — **public**; with a login token `in_wishlist`, `in_cart`, `has_reviewed` and `is_owned` (also on the digital product detail); `covers`, syllabus, mentors, FAQ, and the bootcamp meeting schedule (status, duration, mentor), without video, file, or meeting links
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

- `POST /api/v1/wishlist/items` — `{id}` (`type` optional)
- `GET /api/v1/wishlist`
- `DELETE /api/v1/wishlist/items/:id` — the entry id or the item's own id
- `POST /api/v1/cart/items` — `{id}` (`type` optional); returns the cart: 201 for a new item, 200 when it is already there; rejects items the user already owns
- `GET /api/v1/cart`
- `DELETE /api/v1/cart/items/:id` — the entry id or the item's own id; returns the updated cart (200)
- `DELETE /api/v1/cart` — returns the empty cart (200)
- `GET /api/v1/orders/recent` — last 3 orders, with order numbers
- `GET /api/v1/orders` — full history, paginated, filter by `status` (`pending`, `paid`, `expired`, `failed`, `cancelled`); items carry `image_url` and `merchant_name`

### Checkout and payment (Duitku POP)

- `POST /api/v1/orders/preview` — prices up to 20 items with up to one voucher and one discount code (each applies to its own merchant's items); writes nothing. An invalid code does not fail the preview: it is left out and listed in `rejected_codes: [{code, reason}]` (`not_found`, `expired`, `not_started`, `used_up`, `already_used`, `minimum_not_met`, `not_applicable`); `POST /api/v1/orders` still rejects it
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

Per-file upload limit by level: 1, 5 or 10 GB for class materials, class videos, assignment attachments and digital-product files. Storage quota by level: 30, 100 or 200 GB, counting each distinct file attached to the store's live class materials, class videos, assignment attachments and digital-product files (covers, logos and profile images do not count). Attaching a file that would pass the quota is refused with 400; removing an item frees its space (the stored object is kept); a store over its quota after a level drop keeps its files but cannot add new ones. `level.storage_used_bytes` shows the current use.

- `GET /api/v1/merchant/level-evaluations` — the store's monthly evaluations, newest first

### Merchant dashboard

- `GET /api/v1/merchant/dashboard` — summary and `level` (see Merchant levels); rating, latest review, and activity cover class and digital-product reviews
- `GET /api/v1/merchant/sales` — price, net after code discounts, and payment method per item; revenue figures across the dashboard use the net
- `GET /api/v1/merchant/sales/export` — the filtered sales as JSON `rows` (up to 5,000, `truncated` when there are more) for the page to save as a spreadsheet; same filters as the list
- `GET /api/v1/merchant/customers`
- `GET /api/v1/merchant/wallet` — earning, settled (withdrawable), and lifetime balances
- `GET /api/v1/merchant/balance-history`
- `POST /api/v1/merchant/withdrawals` — "Tarik Saldo": minimum Rp100.000 from the settled balance, Rp5.000 fee, to the primary or a chosen payout account; the amount leaves the balance at once and is transferred manually

### Merchant analytics (Analitik)

Asia/Jakarta days; paid orders only, dated at payment; revenue is the merchant's net, as on the dashboard; a transaction is a paid order with the merchant's items.

- `GET /api/v1/merchant/analytics/student-growth` — `from`, `to` (YYYY-MM-DD), optional `granularity` (`day`/`month`/`year`; by default daily within a month, monthly within a year, otherwise yearly); running total of distinct class students (a person counts once; digital products excluded); at most 400 points
- `GET /api/v1/merchant/analytics/daily-sales` — `month` (YYYY-MM, default the current Asia/Jakarta month); transactions and revenue for every day, plus totals
- `GET /api/v1/merchant/analytics/monthly-revenue` — `year` (default the current Asia/Jakarta year); revenue for each month, plus the year total
- `GET /api/v1/merchant/analytics/summary` — `period` (`today`/`month`/`year`, default `month`); conversion (buyers ÷ distinct visitors, at most 100%, null without visits), retention (buyers with another purchase from the merchant in the previous 90 days), and average order value, each compared with the same elapsed span of the previous period
- `POST /api/v1/analytics/visits` — **public**; `{target_type: storefront|kelas|bootcamp|digital|bundle, target_id, visitor_id}` from the storefront and detail pages; `visitor_id` is needed only without a login token; one visit per merchant, visitor, and day (a login makes the user the visitor); the merchant's own visits and bots are ignored; 60 per minute per client

### Merchant payout accounts (Rekening)

Account numbers are always returned masked. They are stored encrypted when `PAYOUT_ACCOUNT_ENCRYPTION_KEY` is set, and as plain text otherwise.

- `POST /api/v1/merchant/payout-accounts` — optional `is_primary`; the first account is always primary
- `GET /api/v1/merchant/payout-accounts`
- `PATCH /api/v1/merchant/payout-accounts/:id` — `is_primary: true` makes it the primary account
- `POST /api/v1/merchant/payout-accounts/:id/set-primary`
- `DELETE /api/v1/merchant/payout-accounts/:id`

### Merchant discounts

- `GET /api/v1/merchant/discounts/eligible-items` — with `price`, `image_url` and `is_available`
- `POST /api/v1/merchant/discounts` — codes are system-generated: a `once` entry of N creates N single-use codes ("Kode Sekali Pakai", at most 1,000 per request); a `recurring` entry creates one code shared up to its limit, usable once per user; an expired, failed or cancelled order releases it ("Kode Berulang")
- `GET /api/v1/merchant/discounts`
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
- `POST /api/v1/merchant/bundles` — items are `{id}` (`type` optional); a bundle without `status` starts `unpublished`
- `GET /api/v1/merchant/bundles`
- `GET /api/v1/merchant/bundles/:id`
- `PATCH /api/v1/merchant/bundles/:id`
- `DELETE /api/v1/merchant/bundles/:id`
- `GET /api/v1/bundles` — **public**; published bundles, optionally of one merchant

### Merchant digital products

- `GET /api/v1/merchant/digital-products` — own products with downloads, rating, and revenue; filter by `status` (`published`, `unpublished`, `unlisted`) and `search`
- `GET /api/v1/merchant/digital-products/:id` — includes a signed download link for the product file
- `POST /api/v1/merchant/digital-products` — `category_slug`, prices, status (default `unpublished`), cover image, one file (required to publish), post-purchase instructions
- `PATCH /api/v1/merchant/digital-products/:id` — a new `file_asset_id` replaces the single file
- `DELETE /api/v1/merchant/digital-products/:id` — 409 while the product is in a published or unlisted bundle; buyers keep access

### Merchant classes and class management

The class owner has full access. Assigned tutors (`lead`, `assistant`, `moderator`) act within their permission matrix (areas `materi`, `meeting`, `tugas`, `nilai`, `sertifikat` × `lihat`, `tambah`, `edit`, `delete`): missing permission is 403, anyone else gets 404. Class status `archived` means unlisted (hidden from lists, open by link). Writes return `{data, responseMessage}`; deletes return 204.

- `GET /api/v1/merchant/classes` — the signed-in owner's store; filter by `status` and `type`; `limit` up to 100
- `POST /api/v1/merchant/classes` — also accepts Bidang (`category`: Coding/Elektro/Mesin/Desain/Sipil/Kimia), `level` (Pemula/Menengah/Mahir), `duration`, `prerequisites`, and `learning_outcomes` (up to 20); `PATCH /api/v1/classes/:classId` updates them
- `GET /api/v1/classes/:classId`
- `PATCH /api/v1/classes/:classId` — details, prices, cover image, post-purchase instructions; a lead tutor may change only title, description, cover, and instructions
- `POST /api/v1/classes/:classId/duplicate` — owner only; `{type}`; a draft "(Salinan)" copy with details, syllabus, assignments, certificate settings, and FAQ (no learners, reviews, tutors, or meetings)
- `GET /api/v1/classes/:classId/faqs`, `POST /api/v1/classes/:classId/faqs` — `materi` permission; question up to 300, answer up to 3000 characters; at most 50 per class
- `PATCH /api/v1/classes/:classId/faqs/:faqId`, `DELETE /api/v1/classes/:classId/faqs/:faqId`
- `GET /api/v1/classes/:classId/chapters` — chapters with videos and resources in order; file resources carry signed download links. Without `limit` it returns every chapter (the bab reorder needs them all); with `limit` it paginates
- `POST /api/v1/classes/:classId/chapters`
- `PATCH /api/v1/classes/:classId/chapters/:chapterId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId` — also removes its videos and resources
- `PUT /api/v1/classes/:classId/chapters/order` — the complete `chapter_ids` list in the new bab order; new babs go last
- `PUT /api/v1/classes/:classId/chapters/:chapterId/order` — complete `video_ids` and `resource_ids` lists
- `POST /api/v1/classes/:classId/chapters/:chapterId/videos` — a link video (https `youtube_url`) or a file video (`asset_id` of an uploaded MP4/MOV/WebM, within the store level's per-file limit); `source` is inferred from the field sent
- `PATCH /api/v1/classes/:classId/chapters/:chapterId/videos/:videoId`
- `DELETE /api/v1/classes/:classId/chapters/:chapterId/videos/:videoId`
- `POST /api/v1/classes/:classId/chapters/:chapterId/resources` — each material is a `name` with an uploaded `asset_id` or an https `url`; `type` (`pdf`, `archive`, `image`, `file`, `link`) is derived from the file or the link; `data` is the array of added materials
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
- `POST /api/v1/classes/:classId/assignments` — future `due`, `file_upload` or `quiz` (2–4 options per multiple-choice question), an optional attached file
- `PATCH /api/v1/classes/:classId/assignments/:assignmentId` — `tugas.edit`; any field of the create body; submissions are kept, and once there are submissions the type and the quiz questions cannot change (409)
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
- `PUT /api/v1/classes/:classId/certificates/:userId/file` — `sertifikat.edit`; an uploaded PDF, PNG or JPG
- `DELETE /api/v1/classes/:classId/certificates/:userId` — `sertifikat.delete`; withdraws the certificate

### Learning (enrolled learners and buyers)

Every route requires an active enrollment or product access and answers 404 otherwise.

- `GET /api/v1/learning/classes/:id` — `post_purchase_instructions`, chapters, videos (`source`; YouTube id, or a signed `video_url` for file videos; completion), files as signed links, meetings with live links and `my_attendance_status`, FAQ, progress, next video, certificate
- `POST /api/v1/learning/videos/:videoId/complete` — idempotent; returns progress and the next video
- `GET /api/v1/learning/classes/:classId/assignments` — without answer keys; own latest submission
- `GET /api/v1/learning/assignments/:assignmentId/quiz`
- `POST /api/v1/learning/assignments/:assignmentId/submit` — an uploaded PDF, DWG or ZIP; replaces before the due time, late first submission accepted
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
- `POST /api/v1/upload/complete` — also registers the file and returns its `asset_id`; send it in the form field the file is for. The field checks the file when the form is saved: covers, logos, banners, landing backgrounds and the user photo take PNG/JPG/WebP images (2 MB for logo and photo, otherwise 4 MB) and make the file public; class materials, assignment attachments, class videos (MP4/MOV/WebM) and digital-product files (up to the store level's per-file limit: 1, 5 or 10 GB), submissions (PDF/DWG/ZIP, 20 MB), certificate files (PDF/PNG/JPG, 10 MB) and CVs (PDF/DOC/DOCX, 10 MB) make it private. A file used in a public field cannot go into a private one, or the reverse. Each field's accepted types and size are in its Swagger description, and a rejected file gets a plain message such as "The file must be 2 MB or smaller" or "Allowed file types: PDF, DWG or ZIP". Private files are only served through signed links that expire after 10 minutes

### Mentor

- `POST /api/v1/mentor/register` — the mentor fields plus `cv_asset_id` (PDF, DOC or DOCX) and `skill_certificate_asset_id` (PDF, PNG or JPG), each an upload of the caller; a new mentor signs up as a user first; also completes the mentor record of an accepted job applicant
- `GET /api/v1/mentors/:id` — **public**
- `GET /api/v1/mentor/profile`
- `PATCH /api/v1/mentor/profile`
- `GET /api/v1/mentor/assignments` — merchant, product, and class tutor assignments (with role and permissions)
- `GET /api/v1/mentor/dashboard` — stats, upcoming sessions, recent learner messages, class progress
- `GET /api/v1/mentor/classes` — assigned classes (Kelas-kelas) with `cover_url`, filterable by type and search
- `GET /api/v1/mentor/teaching-history` — teaching history (Kelas Mentor on the profile)
- `GET /api/v1/mentor/documents` — CV and skill certificate with short-lived download URLs
- `PATCH /api/v1/mentor/documents` — `cv_asset_id` and/or `skill_certificate_asset_id`; the previous files are kept

### Karir (job board and mentor recruitment)

Merchants publish teaching vacancies; any logged-in user applies once per vacancy. Statuses: `review` → `interview` → `accepted` or `rejected` (a rejected applicant can still be accepted; acceptance is final). Accepting makes the applicant an active mentor (`is_mentor`), adds them to the merchant's mentor list, and, when the vacancy has a class, assigns them as its `assistant` tutor.

- `GET /api/v1/job-postings` — **public**; active vacancies of active merchants with `search` (title, merchant, category, skills), `location`, `category`, `contract_type`, `work_type`, paging, applicant counts, `is_new` (7 days), and the board totals
- `GET /api/v1/job-postings/:id` — **public**; 404 once closed
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
- `GET /api/v1/job-applications` — Progress Lamaran; counts per status
- `GET /api/v1/merchant/job-applications` — filter by `job_id`, `status`, `search`; counts per status; `mentor_id` when the applicant is a mentor
- `GET /api/v1/merchant/job-applications/:id/cv` — signed CV link (10 minutes)
- `POST /api/v1/merchant/job-applications/:id/schedule-interview` — `interview_at` (ISO 8601 with offset) and `interview_url`; rescheduling replaces both
- `POST /api/v1/merchant/job-applications/:id/accept`
- `POST /api/v1/merchant/job-applications/:id/reject`
- `GET /api/v1/merchant/mentors` — accepted applicants plus the tutors of the merchant's classes, with `mentor_id`, class counts and ratings, and the page summary
- `GET /api/v1/merchant/mentors/:userId` — the mentor's classes with students, ratings, and review counts

### Class discussions

Open to the class's merchant owner, its assigned mentors, and enrolled learners; learners can reply but not start threads.

- `GET /api/v1/discussions/threads` — `class_id` query parameter (required)
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
- `ASSET_PUBLIC_BASE_URL`: responses carry image URLs only (no storage keys), so without it every avatar and cover is `null`; the application logs an error at startup when it is missing.
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
