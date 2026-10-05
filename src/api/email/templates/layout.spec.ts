import {
  bulan,
  escapeHtml,
  itemTable,
  multiline,
  paymentMethodLabel,
  rupiah,
  tanggal,
  wib,
} from './layout';

describe('email formatting', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
  });

  it('keeps line breaks of escaped text', () => {
    expect(multiline('Baris 1\n<b>Baris 2</b>\r\nBaris 3')).toBe(
      'Baris 1<br>&lt;b&gt;Baris 2&lt;/b&gt;<br>Baris 3',
    );
  });

  it.each([
    [0, 'Rp 0'],
    [999, 'Rp 999'],
    [150000, 'Rp 150.000'],
    [1234567.6, 'Rp 1.234.568'],
    [-5000, '-Rp 5.000'],
  ])('formats %d as %s', (amount, expected) => {
    expect(rupiah(amount)).toBe(expected);
  });

  it('shows times in Asia/Jakarta with WIB', () => {
    expect(wib('2026-10-05T07:41:00Z')).toBe('5 Oktober 2026, 14.41 WIB');
    expect(wib('2026-09-30T17:30:00Z')).toBe('1 Oktober 2026, 00.30 WIB');
  });

  it('names dates and months in Indonesian', () => {
    expect(tanggal('2026-10-08')).toBe('8 Oktober 2026');
    expect(bulan('2026-09-01')).toBe('September 2026');
  });

  it('names payment methods, and free orders', () => {
    expect(paymentMethodLabel('BC')).toBe('BCA Virtual Account');
    expect(paymentMethodLabel('XX')).toBe('XX');
    expect(paymentMethodLabel(null)).toBe('Gratis');
  });

  it('lists items with the same data in HTML and text', () => {
    const block = itemTable(
      [{ title: 'A & B', type: 'digital', merchant: 'Toko', amount: 1000 }],
      { discount: 100, totalLabel: 'Total', total: 900 },
    );
    expect(block.html).toContain('A &amp; B');
    expect(block.html).toContain('Rp 900');
    expect(block.text).toBe(
      '- A & B (Produk Digital, Toko): Rp 1.000\nDiskon: -Rp 100\nTotal: Rp 900',
    );
  });
});
