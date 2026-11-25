import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InitiateUploadDto } from './initiate-upload.dto';

describe('InitiateUploadDto', () => {
  const errorsFor = async (extra: Record<string, unknown>) =>
    (
      await validate(
        plainToInstance(InitiateUploadDto, {
          fileName: 'a.pdf',
          contentType: 'application/pdf',
          ...extra,
        }),
      )
    ).map((error) => error.property);

  it('accepts no declared size, as current clients send', async () => {
    expect(await errorsFor({})).toEqual([]);
  });

  it.each([0, 1, 12 * 1024 ** 3])(
    'accepts a declared size of %p',
    async (n) => {
      expect(await errorsFor({ fileSize: n })).toEqual([]);
    },
  );

  it.each([-1, 1.5, '1024', Number.MAX_SAFE_INTEGER + 2])(
    'rejects a declared size of %p',
    async (fileSize) => {
      expect(await errorsFor({ fileSize })).toEqual(['fileSize']);
    },
  );
});
