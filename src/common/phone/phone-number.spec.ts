import { normalizePhone, STORED_PHONE } from './phone-number';

describe('normalizePhone', () => {
  it.each([
    ['0812-3456-7890', '6281234567890'],
    ['0812 3456 7890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['+62 0812 3456 7890', '6281234567890'],
    ['62 812 3456 7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['812 3456 7890', '6281234567890'],
    ['(021) 555-1234', '62215551234'],
    ['0062 812 3456 7890', '6281234567890'],
    ['+65 9123 4567', '6591234567'],
    ['+1 (415) 555-0100', '14155550100'],
    [' 0812.3456.7890 ', '6281234567890'],
  ])('stores %j as %s', (typed, stored) => {
    expect(normalizePhone(typed)).toBe(stored);
    expect(STORED_PHONE.test(stored)).toBe(true);
  });

  it.each(['', '   ', '-', 'abc', '0812abc', '+62 812 #1'])(
    'is not a phone number: %j',
    (typed) => {
      expect(normalizePhone(typed)).toBeNull();
    },
  );

  it('leaves the length to the caller', () => {
    expect(STORED_PHONE.test(normalizePhone('12345') as string)).toBe(false);
    expect(
      STORED_PHONE.test(normalizePhone('+1234567890123456') as string),
    ).toBe(false);
  });
});
