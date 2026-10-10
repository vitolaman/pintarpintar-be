# Pro Plan Subscription API Documentation

## Overview

The Pro Plan subscription API allows merchants to purchase Pro subscription plans using the same payment flow as product purchases. The implementation mirrors the existing order checkout and payment system, ensuring consistency across the platform.

## Architecture Comparison

### Order Payment Flow (Existing)
```
User → OrderController.checkout() 
  → CheckoutService.checkout()
    → Create Order (PENDING status)
    → Create Duitku Invoice
    → Return payment URL to client
→ Client pays via Duitku
→ Duitku webhook → PaymentCallbackController
  → OrderPaymentService.applyGatewayResult()
    → Mark Order as PAID
    → Fulfill order (deliver items)
    → Queue email notifications
```

### Pro Subscription Payment Flow (New)
```
User → ProSubscriptionController.checkout()
  → ProCheckoutService.checkout()
    → Create ProTransaction (PENDING status)
    → Create Duitku Invoice
    → Return payment URL to client
→ Client pays via Duitku
→ Duitku webhook → PaymentCallbackController
  → ProPaymentService.applyGatewayResult()
    → Mark ProTransaction as PAID
    → Create MerchantProPeriod
    → Queue email notifications
```

## Key Entities

### 1. ProTransaction (New)
Tracks each Pro subscription attempt, similar to Order.

```sql
CREATE TABLE pro_transactions (
  id UUID PRIMARY KEY
  user_id UUID NOT NULL -- Buyer
  merchant_id UUID NOT NULL -- Target merchant
  plan_id UUID NOT NULL -- Selected plan
  transaction_number VARCHAR(20) -- PRO-YYYYMMDD-NNNN
  total_amount NUMERIC NOT NULL -- After discount
  discount_amount NUMERIC NOT NULL -- Applied codes
  status VARCHAR(16) -- pending|paid|failed|expired|cancelled
  payment_gateway_ref VARCHAR(255) -- Duitku reference
  payment_url TEXT -- Payment page URL
  payment_method VARCHAR(20) -- Channel code (e.g., BC for BCA)
  expires_at TIMESTAMP -- Payment window
  paid_at TIMESTAMP -- When payment received
  -- Plus created_at, updated_at, deleted_at from BaseEntity
)
```

### 2. MerchantProPeriod (Existing, Enhanced)
One subscription period for a merchant. A paid transaction creates a period.

```sql
CREATE TABLE merchant_pro_periods (
  id UUID PRIMARY KEY
  merchant_id UUID NOT NULL
  plan_id UUID -- Nullable for manual grants
  plan_name VARCHAR(80) -- Snapshot at purchase time
  duration_months INTEGER
  price NUMERIC -- Snapshot at purchase time
  starts_at TIMESTAMPTZ NOT NULL
  ends_at TIMESTAMPTZ NOT NULL
  source VARCHAR(16) -- payment|manual
  status VARCHAR(16) -- active|cancelled
  -- Plus timestamps from BaseEntity
)
```

### 3. ProPlan (Existing)
Available subscription plans managed by platform team.

```sql
CREATE TABLE pro_plans (
  id UUID PRIMARY KEY
  code VARCHAR(40) -- Unique: pro-monthly
  name VARCHAR(80) -- Display name
  duration_months INTEGER -- 1-36 months
  price NUMERIC -- > 0
  is_offered BOOLEAN -- Is currently for sale
  display_order INTEGER -- UI sort order
  -- Plus timestamps from BaseEntity
)
```

## API Endpoints

### Public Endpoints

#### GET `/api/v1/pro-plans`
List all currently offered Pro plans.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "pro-monthly",
      "name": "Pro Bulanan",
      "duration_months": 1,
      "price": 49000
    }
  ],
  "responseMessage": "Get Pro plans success"
}
```

---

### Authenticated Endpoints

#### POST `/api/v1/pro-subscription/preview`
Preview subscription pricing before checkout. Validates the plan and applies codes.

**Request:**
```json
{
  "plan_id": "uuid",
  "code": "OPTIONAL_DISCOUNT_CODE"
}
```

**Response:**
```json
{
  "data": {
    "plan_id": "uuid",
    "plan_name": "Pro Bulanan",
    "duration_months": 1,
    "base_price": 49000,
    "discount_amount": 0,
    "total_amount": 49000
  },
  "responseMessage": "Preview Pro subscription success"
}
```

---

#### POST `/api/v1/pro-subscription`
Create a Pro subscription transaction and invoice.

**Request:**
```json
{
  "plan_id": "uuid",
  "code": "OPTIONAL_DISCOUNT_CODE"
}
```

**Response (Pending Payment):**
```json
{
  "data": {
    "transaction_id": "uuid",
    "transaction_number": "PRO-20261009-0001",
    "amount": 49000,
    "discount_amount": 0,
    "total_amount": 49000,
    "status": "pending",
    "payment_reference": "ref123456",
    "payment_url": "https://secure.duitku.com/checkout?ref=...",
    "created_at": "2026-10-09T14:03:31Z",
    "expires_at": "2026-10-09T15:03:31Z",
    "paid_at": null
  },
  "responseMessage": "Pro subscription checkout created"
}
```

**Response (Free Plan):**
Rp0 plans are automatically marked as paid without invoicing.

```json
{
  "data": {
    "transaction_id": "uuid",
    "transaction_number": "PRO-20261009-0002",
    "amount": 0,
    "discount_amount": 0,
    "total_amount": 0,
    "status": "paid",
    "payment_reference": null,
    "payment_url": null,
    "created_at": "2026-10-09T14:03:31Z",
    "expires_at": null,
    "paid_at": "2026-10-09T14:03:31Z"
  },
  "responseMessage": "Pro subscription purchased successfully"
}
```

---

#### POST `/api/v1/pro-subscription/:id/cancel`
Cancel a pending unpaid Pro subscription.

**Response:**
```json
{
  "responseMessage": "Pro subscription cancelled successfully"
}
```

**Errors:**
- `404 Not Found`: Transaction not found or not cancellable
- `400 Bad Request`: Only pending unpaid subscriptions can be cancelled

---

#### GET `/api/v1/merchant/pro-subscription`
Get a merchant's Pro subscription status.

**Response:**
```json
{
  "data": {
    "is_pro": true,
    "pro_until": "2026-11-09T14:03:31Z",
    "current": {
      "id": "uuid",
      "plan_name": "Pro Bulanan",
      "duration_months": 1,
      "price": 49000,
      "starts_at": "2026-10-09T14:03:31Z",
      "ends_at": "2026-11-09T14:03:31Z",
      "source": "payment",
      "status": "active"
    },
    "upcoming": [],
    "history": []
  },
  "responseMessage": "Get Pro subscription success"
}
```

## Payment Flow Detail

### 1. Transaction Creation

When a merchant initiates checkout:

```typescript
// ProCheckoutService.checkout()
- Validate plan exists and is offered
- Calculate total: plan.price - discount
- Validate amount >= Rp10,000 (Duitku minimum)
- Create ProTransaction (PENDING status)
- Generate transaction_number: PRO-YYYYMMDD-NNNN (sequentially, per day)
- Set expires_at to now + 60 minutes
```

Transaction numbers are generated similar to order numbers, using a database advisory lock to ensure sequential numbering per day:

```sql
-- Lock: pro-transaction:YYYYMMDD
-- Query: SELECT max(substring(transaction_number FROM 15)) FROM pro_transactions
--        WHERE transaction_number LIKE 'PRO-YYYYMMDD-%'
-- Result: PRO-YYYYMMDD-0001, PRO-YYYYMMDD-0002, etc.
```

### 2. Invoice Creation

For non-zero amounts:

```typescript
// ProCheckoutService.checkout()
- Call DuitkuClient.createInvoice()
  - orderId: transaction.id
  - orderNumber: transaction.transactionNumber (merchant ID for Duitku)
  - amount: total_amount
  - productDetails: "Pintar Pintar Pro - [Plan Name] ([Duration] bulan)"
  - email: user.email
  - customerName: user.name
  - items: [{ name: plan_name, price: total_amount }]
- Store paymentGatewayRef (Duitku invoice reference)
- Store paymentUrl (Duitku payment page)
```

For Rp0 plans:
- Mark transaction PAID immediately
- Create MerchantProPeriod
- Skip Duitku invoice

### 3. Payment Notification

Duitku sends a callback to `/api/v1/payments/duitku/callback`:

```typescript
// PaymentCallbackController.handleDuitkuCallback()
- Validate callback signature (HMAC)
- Parse merchant order ID (PRO-...)
- Route to ProPaymentService.applyGatewayResult()
```

### 4. Transaction Confirmation

```typescript
// ProPaymentService.applyGatewayResult()
- Lock ProTransaction row (pessimistic write)
- Verify resultCode === '00' (00 = success)
- Verify amount matches transaction.totalAmount
- If already PAID, return 'unchanged' (idempotent)
- If success:
  - Mark transaction PAID
  - Create MerchantProPeriod:
    - starts_at = now
    - ends_at = now + [duration_months]
    - source = 'payment'
    - status = 'active'
  - Queue email notification
  - Return 'paid'
- If failure and PENDING:
  - Mark transaction FAILED
  - Queue email notification
  - Return 'failed'
```

### 5. Pro Status Calculation

Merchants can check their Pro status with `/api/v1/merchant/pro-subscription`:

```typescript
// ProService.findSubscription()
- Load all MerchantProPeriods for merchant
- Group by status and time:
  - current: Active period covering now
  - upcoming: Active periods starting later
  - history: Ended or cancelled periods
  - is_pro: true if current exists
  - pro_until: End of continuous Pro coverage (extends if back-to-back)
```

**Back-to-back Logic:** If periods are adjacent with no gap, they extend one continuous Pro stretch.

## Payment Method Integration

Duitku supports multiple payment methods:

| Channel Code | Method | Settlement |
|-------------|--------|-----------|
| BC | BCA Virtual Account | H+1 |
| BRI | BRI Virtual Account | H+1 |
| PERMATA | Permata Virtual Account | H+1 |
| MANDIRI | Mandiri Virtual Account | H+1 |
| OVO | OVO | Immediate |
| SP | Shopee Pay | H+1 |
| GOPAY | GoPay | H+1 |
| DANAMON | Danamon Virtual Account | H+1 |

The `paymentMethod` field stores the channel code (up to 20 chars).

## Error Handling

### Validation Errors (400 Bad Request)
- Plan not found or not offered
- Amount < Rp10,000 (below Duitku minimum)
- Invalid discount code
- Amount mismatch in payment callback
- Invalid callback signature

### Not Found (404)
- Plan ID doesn't exist
- Transaction ID doesn't exist
- Merchant not found for user

### Gateway Errors (502/503)
- Payment gateway unavailable
- Payment gateway not configured

## Transaction Idempotency

All payment state changes are idempotent:

1. **Multiple invoices same transaction:** Only first Duitku call succeeds; rest fail or return existing invoice
2. **Duplicate callbacks:** First callback marks PAID; subsequent callbacks return 'unchanged'
3. **Concurrent requests:** Database pessimistic locks ensure one-at-a-time processing

## Implementation Details

### Files Modified/Created

**New Files:**
- `src/api/pro/dto/pro-subscribe.dto.ts` - Request/response DTOs
- `src/api/pro/entities/pro-transaction.entity.ts` - Transaction entity
- `src/api/pro/pro-checkout.service.ts` - Checkout logic
- `src/api/payment/pro-payment.service.ts` - Payment processing
- `src/api/email/events/pro-subscription-emails.ts` - Email notifications (stub)
- `src/database/migrations/pintar-pintar/1793410000000-create-pro-transactions-table.ts` - Migration

**Updated Files:**
- `src/api/pro/pro.controller.ts` - Added ProSubscriptionController
- `src/api/pro/pro.module.ts` - Added new services and PaymentModule import
- `src/api/payment/payment.module.ts` - Added ProPaymentService
- `src/api/payment/payment-callback.controller.ts` - Route PRO- transactions to ProPaymentService

### Database Query Examples

**Create transaction:**
```sql
INSERT INTO pro_transactions (user_id, merchant_id, plan_id, transaction_number, 
  plan_name, duration_months, total_amount, discount_amount, status, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now() + INTERVAL '60 minutes')
RETURNING *;
```

**Mark paid and create period:**
```sql
BEGIN;
UPDATE pro_transactions SET status = 'paid', paid_at = now() WHERE id = $1;
INSERT INTO merchant_pro_periods (merchant_id, plan_id, plan_name, duration_months, 
  price, starts_at, ends_at, source, status)
VALUES ($2, $3, $4, $5, $6, now(), now() + INTERVAL '$7 months', 'payment', 'active');
COMMIT;
```

**Check Pro status:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'active' AND ends_at > now()) > 0 AS is_pro,
  MAX(ends_at) FILTER (WHERE status = 'active' AND ends_at > now()) AS pro_until,
  -- And period groupings by status/time
FROM merchant_pro_periods
WHERE merchant_id = $1 AND deleted_at IS NULL;
```

## Testing Checklist

- [ ] Duitku sandbox environment configured
- [ ] New migration runs successfully
- [ ] Preview endpoint validates plans and prices
- [ ] Checkout creates transaction with correct details
- [ ] Transaction numbers are sequential per day
- [ ] Payment URL is returned correctly
- [ ] Free plans (Rp0) are marked paid immediately
- [ ] Payment callback routes correctly (PRO- vs ORD-)
- [ ] Successful payment marks transaction PAID and creates period
- [ ] Failed payment marks transaction FAILED
- [ ] Callbacks are idempotent (duplicate = no effect)
- [ ] Cancel endpoint only works for pending unpaid
- [ ] Pro status endpoint returns correct periods
- [ ] Back-to-back periods extend pro_until correctly

## Future Enhancements

1. **Discount Codes:** Apply platform-wide and merchant-specific discount codes
2. **Email Templates:** Create styled email notifications for subscription events
3. **Refunds:** Handle Pro subscription refunds and cancellations
4. **Recurring Billing:** Auto-renew subscriptions after expiry
5. **Trial Periods:** Offer free trial Pro access
6. **Analytics:** Track subscription revenue and retention metrics
7. **Admin Portal:** Create/manage plans and grant manual Pro periods
