import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogQueryDto } from './catalog.dto';

describe('CatalogQueryDto file_format', () => {
  it('expands frontend file types to stored formats', async () => {
    const query = plainToInstance(CatalogQueryDto, {
      file_format: 'PDF, Excel,powerpoint',
    });

    expect(await validate(query)).toEqual([]);
    expect(query.file_format).toEqual([
      'pdf',
      'excel',
      'xls',
      'xlsx',
      'powerpoint',
      'ppt',
      'pptx',
    ]);
  });

  it('rejects a merchant id that is not a uuid', async () => {
    const query = plainToInstance(CatalogQueryDto, { merchant_id: 'toko' });

    expect((await validate(query)).map((error) => error.property)).toEqual([
      'merchant_id',
    ]);
  });
});
