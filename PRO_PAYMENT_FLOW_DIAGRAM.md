# Pro Subscription Payment Flow - Detailed Diagrams

## Complete User Journey

```
┌─────────────┐
│   Merchant  │
└──────┬──────┘
       │
       ├─→ GET /api/v1/pro-plans
       │   Response: [ProPlan, ProPlan, ...]
       │
       ├─→ POST /api/v1/pro-subscription/preview
       │   Request: { plan_id, code? }
       │   Response: { base_price, discount, total, ... }
       │
       └─→ POST /api/v1/pro-subscription
           Request: { plan_id, code? }
           │
           ├─ ProCheckoutService.checkout()
           │  ├─ Validate plan exists & offered
           │  ├─ Calculate: total = price - discount
           │  ├─ Create ProTransaction (PENDING)
           │  │  └─ transaction_number = PRO-YYYYMMDD-NNNN
           │  ├─ Create Duitku Invoice
           │  └─ Return { payment_url, payment_reference, ... }
           │
           └─ Response: ProSubscriptionCheckoutResponseDto
              {
                transaction_id, transaction_number,
                total_amount, payment_url,
                status: "pending", expires_at
              }
                     ↓
              [User pays via payment_url]
                     ↓
              Duitku processes payment
                     ↓
           POST /api/v1/payments/duitku/callback
              {
                merchantOrderId: "PRO-20261009-0001",
                resultCode: "00",  // success
                amount: "49000",
                reference: "ref123456",
                paymentCode: "BC",
                settlementDate: "2026-10-09"
              }
                     ↓
           PaymentCallbackController
           ├─ Validate signature
           ├─ Route: merchantOrderId.startsWith("PRO-")
           │  ├─ true: ProPaymentService.applyGatewayResult()
           │  └─ false: OrderPaymentService.applyGatewayResult()
           │
           └─ ProPaymentService.applyGatewayResult()
              ├─ Lock ProTransaction row
              ├─ Verify amount matches
              ├─ If resultCode === "00":
              │  ├─ Mark ProTransaction PAID
              │  ├─ Create MerchantProPeriod
              │  │  └─ starts_at=now, ends_at=now+N_months
              │  ├─ Queue emails
              │  └─ Return "paid"
              └─ Else: Mark FAILED, queue email
                     ↓
           Merchant checks status:
           GET /api/v1/merchant/pro-subscription
           Response: {
             is_pro: true,
             pro_until: "2026-11-09T14:03:31Z",
             current: { plan_name, duration_months, ... },
             upcoming: [],
             history: []
           }
```

## Database Transaction Flow

```
┌──────────────────────────────────────────────────────────────┐
│ ProCheckoutService.checkout()                                │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ BEGIN TRANSACTION                                       │  │
│ │                                                         │  │
│ │ 1. SELECT pro_plans WHERE id=? AND is_offered=true    │  │
│ │    → Validate plan exists                              │  │
│ │                                                         │  │
│ │ 2. INSERT INTO pro_transactions (                       │  │
│ │      user_id, merchant_id, plan_id,                    │  │
│ │      transaction_number, status, ...                   │  │
│ │    ) VALUES (...)                                      │  │
│ │    → Create pending transaction                        │  │
│ │                                                         │  │
│ │ COMMIT                                                  │  │
│ └─────────────────────────────────────────────────────────┘  │
│                          ↓                                     │
│ Generate transaction_number (PRO-YYYYMMDD-NNNN):             │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ SELECT pg_advisory_xact_lock(hashtext(                 │  │
│ │   'pro-transaction:20261009'                           │  │
│ │ ))                                                      │  │
│ │ → Lock ensures sequential numbering                    │  │
│ │                                                         │  │
│ │ SELECT max(substring(transaction_number FROM 15))      │  │
│ │ FROM pro_transactions                                  │  │
│ │ WHERE transaction_number LIKE 'PRO-20261009-%'        │  │
│ │ → Get last sequence number (e.g., 0001)                │  │
│ │                                                         │  │
│ │ Return: PRO-20261009-0002                              │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                          ↓
        [Merchant pays via Duitku]
                          ↓
       Duitku sends callback webhook
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ ProPaymentService.applyGatewayResult()                       │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ BEGIN TRANSACTION                                       │  │
│ │                                                         │  │
│ │ 1. SELECT id, status, total_amount FROM pro_transactions│ │
│ │    WHERE transaction_number = ?                        │  │
│ │    FOR UPDATE (PESSIMISTIC LOCK)                       │  │
│ │    → Lock prevents concurrent updates                  │  │
│ │                                                         │  │
│ │ 2. IF status === 'paid':                               │  │
│ │      RETURN 'unchanged'  -- idempotent                 │  │
│ │                                                         │  │
│ │ 3. IF resultCode !== '00':                             │  │
│ │      UPDATE pro_transactions SET status='failed'       │  │
│ │      COMMIT & RETURN 'failed'                          │  │
│ │                                                         │  │
│ │ 4. SUCCESS PATH:                                       │  │
│ │                                                         │  │
│ │    a. UPDATE pro_transactions                          │  │
│ │       SET status = 'paid',                             │  │
│ │           paid_at = now(),                             │  │
│ │           payment_method = ?                           │  │
│ │       WHERE id = ?                                     │  │
│ │                                                         │  │
│ │    b. INSERT INTO merchant_pro_periods (               │  │
│ │         merchant_id, plan_id, plan_name,               │  │
│ │         duration_months, price,                        │  │
│ │         starts_at = now(),                             │  │
│ │         ends_at = now() + interval 'N months',         │  │
│ │         source = 'payment',                            │  │
│ │         status = 'active'                              │  │
│ │       )                                                │  │
│ │       → Pro access is now active                       │  │
│ │                                                         │  │
│ │    c. Queue email notifications                        │  │
│ │                                                         │  │
│ │ COMMIT                                                  │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Status Lifecycle Diagram

```
                ┌─────────┐
                │ Initial │
                └────┬────┘
                     │
        ProCheckoutService.checkout()
                     │
                     ↓
            ┌─────────────────┐
            │    PENDING      │ ← 60 min expiry timer starts
            │  transaction    │
            │  created        │
            └────┬──────┬─────┘
                 │      │
    ┌────────────┘      └─────────────────┐
    │                                      │
    │ Payment succeeded                    │ Payment failed/expired
    │ (resultCode='00')                    │
    │                                      │
    ↓                                      ↓
┌─────────┐                           ┌───────────┐
│  PAID   │ → MerchantProPeriod       │  FAILED   │
│         │   created automatically   │           │
│         │   (starts now, ends       │           │
│         │    in N months)           │           │
└─────────┘                           └───────────┘
    ↓                                      ↓
    │                                      │
    ├─ User cancels (before paid)          │
    │                                      │
    ↓                                      ↓
┌───────────┐                          ┌─────────┐
│ CANCELLED │                          │ EXPIRED │
│           │                          │         │
│ (if       │                          │ (after  │
│  before   │                          │  60min  │
│  payment) │                          │  no     │
└───────────┘                          │  payment)
                                       └─────────┘

Possible Status Values:
• pending  → Created, awaiting payment (0-60 min)
• paid     → Payment confirmed, Pro period active
• failed   → Payment attempt failed
• expired  → Payment window closed without payment
• cancelled → User cancelled before payment
```

## Parallel Requests Safety

```
Scenario: Merchant clicks "Pay" multiple times or retries payment

Request 1                          Request 2
POST /api/v1/pro-subscription     POST /api/v1/pro-subscription
│                                  │
├─ Lock row advisory              ├─ Waits for lock
│  'pro-transaction:20261009'     │
│                                  │
├─ Creates transaction            ├─ Lock acquired
│  PRO-20261009-0001              │
│                                  │
├─ Create Duitku invoice          ├─ Queries same plan
│  invoice_ref: "ref123"          │
│                                  │
├─ Returns payment URL            ├─ Creates transaction
│  unlock advisory lock           │  PRO-20261009-0002 (✓ different number)
└─ 200 OK                         │
                                  ├─ Create Duitku invoice
                                  │
                                  └─ Returns payment URL
                                     200 OK

Scenario: Multiple payment callbacks (duplicate webhooks)

Callback 1                         Callback 2
duitku/callback                    duitku/callback
merchantOrderId=PRO-20261009-0001  merchantOrderId=PRO-20261009-0001
│                                  │
├─ Lock transaction row           ├─ Waits for lock
│  FOR UPDATE                      │
│                                  │
├─ Check status = PENDING         ├─ Lock acquired
│                                  │
├─ resultCode='00'                ├─ Check status = PAID
│  → Eligible to process           │
│                                  ├─ Status already PAID
├─ Update status=PAID             │
│                                  ├─ Return 'unchanged'
├─ Create MerchantProPeriod       │
│  (subscription now active)      ├─ No changes made
│                                  │
├─ Unlock row                      ├─ Unlock row
└─ Return 'paid'                  └─ 200 OK (idempotent ✓)
   200 OK
```

## Free Plan Handling

```
POST /api/v1/pro-subscription
{ plan_id: "free-plan-id", ... }
        │
        ├─ ProCheckoutService.checkout()
        │  ├─ Load plan → price = 0
        │  ├─ Calculate total → 0
        │  ├─ totalAmount === 0?
        │  │  └─ YES
        │  │
        │  ├─ Apply payment result immediately
        │  │  (skip Duitku invoice)
        │  │
        │  └─ ProPaymentService.applyGatewayResult()
        │     ├─ resultCode = '00' (faked)
        │     ├─ Mark PAID
        │     ├─ Create MerchantProPeriod
        │     └─ Queue email
        │
        └─ Response:
           {
             status: 'paid',
             paid_at: now(),
             payment_url: null,
             payment_reference: null,
             total_amount: 0
           }

Result: Pro access activated immediately without payment
```

## Pro Status Calculation

```
Query: GET /api/v1/merchant/pro-subscription
       for merchant_id = "M123"

Database Query:
SELECT id, plan_name, starts_at, ends_at, status
FROM merchant_pro_periods
WHERE merchant_id = 'M123' AND deleted_at IS NULL
ORDER BY starts_at DESC

Results (example):
┌─────────────────────────────────────────────────────────┐
│ id  │ plan_name   │ starts_at    │ ends_at      │ status │
├─────────────────────────────────────────────────────────┤
│ A   │ Pro Monthly │ 2026-10-09   │ 2026-11-09   │ active │
│ B   │ Pro Monthly │ 2026-11-09   │ 2026-12-09   │ active │
│ C   │ Pro Monthly │ 2026-12-09   │ 2027-01-09   │ active │
│ D   │ Pro Yearly  │ 2027-06-09   │ 2028-06-09   │ active │
└─────────────────────────────────────────────────────────┘

Current time: 2026-10-15

Processing:
┌─────────────────────────────────────────────────────┐
│ current period:  A (starts before now, ends after)  │
├─────────────────────────────────────────────────────┤
│ upcoming:        B, C, D (starts after now)         │
│                  Wait, B starts at A's end...       │
│                  Back-to-back logic applies         │
├─────────────────────────────────────────────────────┤
│ pro_until:       A.ends_at = 2026-11-09            │
│                  B.starts_at = 2026-11-09 (same)   │
│                  Extends to B.ends_at = 2026-12-09 │
│                  C.starts_at = 2026-12-09 (same)   │
│                  Extends to C.ends_at = 2027-01-09 │
│                  D.starts_at = 2027-06-09 (gap!)   │
│                  Stop extending                     │
│                  pro_until = 2027-01-09            │
└─────────────────────────────────────────────────────┘

Response:
{
  is_pro: true,
  pro_until: "2027-01-09T00:00:00Z",
  current: {
    id: "A",
    plan_name: "Pro Monthly",
    starts_at: "2026-10-09T00:00:00Z",
    ends_at: "2026-11-09T00:00:00Z",
    status: "active"
  },
  upcoming: [
    { id: "B", starts_at: "2026-11-09T...", ... },
    { id: "C", starts_at: "2026-12-09T...", ... },
    { id: "D", starts_at: "2027-06-09T...", ... }
  ],
  history: []
}

Key Points:
• is_pro = true (active period covers now)
• pro_until extends through continuous back-to-back periods
• Includes gap-separated periods in upcoming (D)
• Newest history items first (reverse chronological)
```

## Error Scenarios

```
❌ Scenario 1: Plan not found
   POST /api/v1/pro-subscription
   { plan_id: "invalid-id" }
   → 404 Not Found
   "Pro plan not found"

❌ Scenario 2: Amount below minimum
   POST /api/v1/pro-subscription
   { plan_id: "cheap-plan" }  [price = Rp5,000]
   → 400 Bad Request
   "Minimum payment amount is 10000"

❌ Scenario 3: Duitku unavailable
   [DuitkuClient.createInvoice() throws]
   → 502 Bad Gateway
   "Payment gateway is unavailable"

❌ Scenario 4: Cancel non-pending
   POST /api/v1/pro-subscription/:id/cancel
   [transaction already paid]
   → 400 Bad Request
   "Only pending unpaid subscriptions can be cancelled"

❌ Scenario 5: Amount mismatch in callback
   Duitku says: amount = "49000"
   Database shows: total_amount = "50000"
   → 400 Bad Request
   "Amount does not match the transaction"

❌ Scenario 6: Invalid callback signature
   [HMAC doesn't match]
   → 400 Bad Request
   "Invalid callback signature"
```

