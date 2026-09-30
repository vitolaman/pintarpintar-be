import {
  isValidCallbackSignature,
  requestSignature,
  statusSignature,
} from './duitku-signature';

// Expected values computed independently with
// `printf '<message>' | openssl dgst -sha256 -hmac secret-key`.
const KEY = 'secret-key';

describe('Duitku signatures', () => {
  it('signs POP requests as HMAC-SHA256(merchantCode + timestamp)', () => {
    expect(requestSignature('DMOCK1', '1700000000000', KEY)).toBe(
      '556bd0f8d731d41e478457ae55e1920a6fd38bfe89af6b4269e7206be321ccfd',
    );
  });

  it('signs status checks as HMAC-SHA256(merchantCode + merchantOrderId)', () => {
    expect(statusSignature('DMOCK1', 'ORD-20260930-0001', KEY)).toBe(
      'a57ccdc2d3d26064600a6a5b3c917964b00428fcedd887db44a8038951bbc7f1',
    );
  });

  describe('callback verification', () => {
    const callback = {
      merchantCode: 'DMOCK1',
      amount: '150000',
      merchantOrderId: 'ORD-20260930-0001',
    };
    const signature =
      '0cef7caae789e3416f1612ee5bcb5fabb8e54701e201f152a1dc62e048d7c8bd';

    it('accepts HMAC-SHA256(merchantCode + amount + merchantOrderId)', () => {
      expect(isValidCallbackSignature(callback, signature, KEY)).toBe(true);
      expect(
        isValidCallbackSignature(callback, signature.toUpperCase(), KEY),
      ).toBe(true);
    });

    it.each([
      ['a different amount', { ...callback, amount: '150000.00' }, signature],
      ['another order', { ...callback, merchantOrderId: 'ORD-X' }, signature],
      ['another key', callback, signature.replace(/^0/, '1')],
      ['a truncated signature', callback, signature.slice(0, 10)],
    ])('rejects %s', (_case, body, received) => {
      expect(isValidCallbackSignature(body, received, KEY)).toBe(false);
    });
  });
});
