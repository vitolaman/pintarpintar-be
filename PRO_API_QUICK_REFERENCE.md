# Pro Subscription API - Quick Reference

## Endpoints Summary

### 1. List Plans
```http
GET /api/v1/pro-plans
Authorization: (none)

Response 200:
{
  "data": [
    { "id": "uuid", "code": "pro-monthly", "name": "Pro Bulanan", 
      "duration_months": 1, "price": 49000 },
    { "id": "uuid", "code": "pro-yearly", "name": "Pro Tahunan",
      "duration_months": 12, "price": 490000 }
  ],
  "responseMessage": "Get Pro plans success"
}
```

### 2. Preview Subscription
```http
POST /api/v1/pro-subscription/preview
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "plan_id": "uuid",
  "code": "OPTIONAL_CODE"  // discount or voucher code
}

Response 200:
{
  "data": {
    "plan_id": "uuid",
    "plan_name": "Pro Bulanan",
    "duration_months": 1,
    "base_price": 49000,
    "discount_amount": 5000,     // if code applied
    "total_amount": 44000
  },
  "responseMessage": "Preview Pro subscription success"
}

Response 404:
{ "message": "Pro plan not found", "statusCode": 404 }

Response 400:
{ "message": "Minimum payment amount is 10000", "statusCode": 400 }
```

### 3. Create Subscription
```http
POST /api/v1/pro-subscription
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "plan_id": "uuid",
  "code": "OPTIONAL_CODE"
}

Response 201:
{
  "data": {
    "transaction_id": "uuid",
    "transaction_number": "PRO-20261009-0001",
    "amount": 49000,              // price + discount (before discount)
    "discount_amount": 5000,
    "total_amount": 44000,        // amount to pay
    "status": "pending",
    "payment_reference": "12345...",  // Duitku invoice ID
    "payment_url": "https://secure.duitku.com/checkout?...",
    "created_at": "2026-10-09T14:03:31.682Z",
    "expires_at": "2026-10-09T15:03:31.682Z",  // 60 minutes
    "paid_at": null
  },
  "responseMessage": "Pro subscription checkout created"
}

Free Plan Response (Rp0):
{
  "data": {
    "transaction_id": "uuid",
    "transaction_number": "PRO-20261009-0001",
    "amount": 0,
    "discount_amount": 0,
    "total_amount": 0,
    "status": "paid",             // immediately paid
    "payment_reference": null,
    "payment_url": null,
    "created_at": "2026-10-09T14:03:31.682Z",
    "expires_at": null,
    "paid_at": "2026-10-09T14:03:31.682Z"  // now
  },
  "responseMessage": "Pro subscription purchased successfully"
}

Response 404:
{ "message": "Pro plan not found", "statusCode": 404 }
{ "message": "Merchant not found", "statusCode": 404 }

Response 400:
{ "message": "Minimum payment amount is 10000", "statusCode": 400 }

Response 502/503:
{ "message": "Payment gateway is unavailable", "statusCode": 502 }
```

### 4. Cancel Subscription
```http
POST /api/v1/pro-subscription/{transaction_id}/cancel
Authorization: Bearer {token}

Response 200:
{
  "responseMessage": "Pro subscription cancelled successfully"
}

Response 404:
{ "message": "Pro transaction not found or not cancellable", "statusCode": 404 }

Response 400:
{ "message": "Only pending unpaid subscriptions can be cancelled", "statusCode": 400 }
```

### 5. Get Pro Status
```http
GET /api/v1/merchant/pro-subscription
Authorization: Bearer {token}

Response 200:
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
      "source": "payment",      // "payment" or "manual"
      "status": "active"        // "active" or "cancelled"
    },
    "upcoming": [],
    "history": []
  },
  "responseMessage": "Get Pro subscription success"
}

Response 404:
{ "message": "Merchant not found", "statusCode": 404 }
```

## HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Successful GET, preview |
| 201 | Created | Successful subscription creation |
| 400 | Bad Request | Invalid input, amount too low, expired transaction |
| 404 | Not Found | Plan/transaction/merchant doesn't exist |
| 502 | Bad Gateway | Duitku payment gateway unavailable |
| 503 | Unavailable | Gateway not configured |

## Request/Response Flow

```
1. GET /pro-plans
   → Find plan

2. POST /pro-subscription/preview
   → Verify pricing

3. POST /pro-subscription
   → Get payment_url and payment_reference

4. Client navigates to payment_url
   → Customer enters payment method

5. Duitku processes payment
   → Payment succeeds/fails

6. Duitku webhook to /payments/duitku/callback
   → ProPaymentService updates status

7. GET /merchant/pro-subscription
   → Verify Pro is now active
```

## Test Scenarios

### Successful Payment
1. Call preview endpoint (check total_amount)
2. Call checkout endpoint (get payment_url)
3. (Simulate Duitku) Call `/payments/duitku/callback` with resultCode='00'
4. Call get status → should see Pro active

### Free Plan
1. Call checkout with Rp0 plan
2. Immediately returns status='paid'
3. No payment URL, no expiry
4. Pro is active immediately

### Failed Payment
1. Call checkout (get payment_url)
2. Call callback with resultCode='03' (failed)
3. Status becomes 'failed'
4. Get status → Pro should be inactive

### Expired Payment
1. Call checkout (get expiry time)
2. Wait 60+ minutes (or trigger expiry job)
3. Call get status → transaction shown in history
4. Pro not active

### Cancel Pending
1. Call checkout (status='pending')
2. Call cancel endpoint
3. Status becomes 'cancelled'
4. Get status → shown in history, not active

## Important Notes

- **Transaction Number Format**: PRO-YYYYMMDD-NNNN (Asia/Jakarta timezone)
- **Payment Expiry**: 60 minutes from creation
- **Minimum Amount**: Rp10,000 (Duitku limit)
- **Duration**: 1-36 months
- **Pro Status**: Real-time based on MerchantProPeriod, back-to-back periods extend coverage
- **Idempotency**: Payment callbacks are idempotent (safe to retry)
- **Discount**: Applied at checkout, codes snapshot in transaction

## Client Integration Example

```javascript
// Step 1: Get available plans
const plans = await fetch('/api/v1/pro-plans').then(r => r.json());

// Step 2: User selects plan
const selectedPlan = plans.data[0];  // Pro Bulanan

// Step 3: Preview price
const preview = await fetch('/api/v1/pro-subscription/preview', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    plan_id: selectedPlan.id
  })
}).then(r => r.json());

console.log(`Total: Rp${preview.data.total_amount}`);

// Step 4: Create subscription
const subscription = await fetch('/api/v1/pro-subscription', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    plan_id: selectedPlan.id
  })
}).then(r => r.json());

// Step 5: Redirect to payment
if (subscription.data.payment_url) {
  window.location.href = subscription.data.payment_url;
  // After payment, Duitku redirects back and webhook confirms
}

// Step 6: Check status after payment
const status = await fetch('/api/v1/merchant/pro-subscription', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

console.log(`Is Pro: ${status.data.is_pro}`);
console.log(`Until: ${status.data.pro_until}`);
```

