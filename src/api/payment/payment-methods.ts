// Readable names of Duitku payment channel codes, shared by the API
// responses and the emails so a channel reads the same everywhere.
const PAYMENT_METHODS: Record<string, string> = {
  BC: 'BCA Virtual Account',
  M2: 'Mandiri Virtual Account',
  I1: 'BNI Virtual Account',
  BR: 'BRI Virtual Account',
  BT: 'Permata Virtual Account',
  B1: 'CIMB Niaga Virtual Account',
  A1: 'ATM Bersama',
  OV: 'OVO',
  SP: 'ShopeePay',
  DA: 'DANA',
  LA: 'LinkAja',
  NQ: 'QRIS',
  FT: 'Gerai Retail',
  VC: 'Kartu Kredit',
};

/** The name of a paid order's channel; a paid order without one was free. */
export function paymentChannelName(code: string | null): string {
  if (!code) return 'Gratis';
  return PAYMENT_METHODS[code] ?? code;
}

/** The channel name to show for an order, or none while it is unpaid. */
export function paymentMethodLabel(
  code: string | null,
  paid: boolean,
): string | null {
  return paid ? paymentChannelName(code) : null;
}
