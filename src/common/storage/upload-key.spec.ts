import { buildUploadKey, isOwnUploadKey } from './upload-key';

const USER = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';

describe('upload keys', () => {
  it('prefixes keys with the uploader and sanitizes the file name', () => {
    expect(buildUploadKey(USER, 'denah lantai 1.dwg', 1790900000000)).toBe(
      `uploads/${USER}/1790900000000-denah_lantai_1.dwg`,
    );
  });

  it.each([
    [`uploads/${USER}/1-a.pdf`, USER, true],
    [`uploads/${USER}/1-a.pdf`, OTHER, false],
    ['uploads/1790900000000-a.pdf', USER, false],
    [`uploads/${USER}/nested/1-a.pdf`, USER, false],
    [`other/${USER}/1-a.pdf`, USER, false],
  ])('%s owned by %s: %s', (key, user, owned) => {
    expect(isOwnUploadKey(key, user)).toBe(owned);
  });
});
