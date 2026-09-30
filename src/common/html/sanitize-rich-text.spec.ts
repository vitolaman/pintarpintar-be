import { sanitizeRichText } from './sanitize-rich-text';

describe('sanitizeRichText', () => {
  it('keeps the formatting the description editor produces', () => {
    const html =
      '<div style="text-align: center"><b>Halo</b> <i>dunia</i> <u>teknik</u></div>' +
      '<span style="font-size: 24px">Besar</span>';

    // Styles come back normalized without spaces.
    expect(sanitizeRichText(html)).toBe(html.replace(/: /g, ':'));
  });

  it.each([
    ['<script>alert(1)</script>Aman', 'Aman'],
    ['<img src=x onerror="alert(1)">Teks', 'Teks'],
    ['<a href="javascript:alert(1)">klik</a>', 'klik'],
    ['<span onclick="steal()">Teks</span>', '<span>Teks</span>'],
    ['<iframe src="https://evil.example"></iframe>Isi', 'Isi'],
    ['<style>body{display:none}</style>Isi', 'Isi'],
  ])('removes unsafe markup from %j', (input, expected) => {
    expect(sanitizeRichText(input)).toBe(expected);
  });

  it('drops styles outside the allowlist', () => {
    expect(
      sanitizeRichText(
        '<span style="font-size: 72px; color: red; background: url(x)">Teks</span>',
      ),
    ).toBe('<span>Teks</span>');
  });

  it('keeps an allowed style next to a removed one', () => {
    expect(
      sanitizeRichText(
        '<p style="text-align: right; position: fixed">Kanan</p>',
      ),
    ).toBe('<p style="text-align:right">Kanan</p>');
  });
});
