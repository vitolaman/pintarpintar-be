// Unpaid orders, and their Duitku invoices, stay payable for this long.
export const PAYMENT_EXPIRY_MINUTES = 60;

// Duitku rejects payments below this amount (IDR).
export const MINIMUM_PAYMENT_AMOUNT = 10_000;

// Settlement lag when Duitku reports no date: the longest documented
// channel settlement (credit cards, H+4).
export const SETTLEMENT_FALLBACK_DAYS = 4;
