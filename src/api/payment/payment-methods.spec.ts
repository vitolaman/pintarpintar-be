import { paymentMethodLabel } from './payment-methods';

describe('paymentMethodLabel', () => {
  it('names a known channel of a paid order', () => {
    expect(paymentMethodLabel('BC', true)).toBe('BCA Virtual Account');
    expect(paymentMethodLabel('M2', true)).toBe('Mandiri Virtual Account');
  });

  it('keeps an unknown channel code as it is', () => {
    expect(paymentMethodLabel('XX', true)).toBe('XX');
  });

  it('calls a paid order without a channel free', () => {
    expect(paymentMethodLabel(null, true)).toBe('Gratis');
  });

  it('names nothing while the order is unpaid', () => {
    expect(paymentMethodLabel(null, false)).toBeNull();
    expect(paymentMethodLabel('BC', false)).toBeNull();
  });
});
