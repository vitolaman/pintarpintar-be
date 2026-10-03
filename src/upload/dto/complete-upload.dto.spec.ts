import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadPartDto } from './complete-upload.dto';

describe('UploadPartDto', () => {
  const errorsFor = async (PartNumber: unknown) =>
    (
      await validate(
        plainToInstance(UploadPartDto, { ETag: '"etag"', PartNumber }),
      )
    ).map((error) => error.property);

  it('accepts a part number from 1 to 10000', async () => {
    expect(await errorsFor(1)).toEqual([]);
    expect(await errorsFor(10000)).toEqual([]);
  });

  it.each([0, 1.5, 10001, '2'])('rejects %p', async (PartNumber) => {
    expect(await errorsFor(PartNumber)).toEqual(['PartNumber']);
  });
});
