import { assetUrl } from './asset-url';

describe('assetUrl', () => {
  it('joins the base and the key without doubled slashes', () => {
    expect(assetUrl('uploads/1-logo.png', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/uploads/1-logo.png',
    );
  });

  it('encodes each key segment', () => {
    expect(assetUrl('uploads/logo toko.png', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/uploads/logo%20toko.png',
    );
  });

  it.each([
    [null, 'https://cdn.example.com'],
    ['uploads/1-logo.png', undefined],
    ['uploads/1-logo.png', ''],
  ])('returns null when the key (%j) or base (%j) is missing', (key, base) => {
    expect(assetUrl(key, base)).toBeNull();
  });
});
