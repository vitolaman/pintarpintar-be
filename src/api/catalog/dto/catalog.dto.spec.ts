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

describe('CatalogQueryDto filters', () => {
  const parse = (input: object) => plainToInstance(CatalogQueryDto, input);
  const errorFields = async (input: object) =>
    (await validate(parse(input))).map((error) => error.property);

  it('treats blank filters as no filter and keeps the default sort', async () => {
    const query = parse({
      type: '',
      search: '  ',
      level: '',
      category: ' ',
      merchant_id: '',
      file_format: '',
      sort: '',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      type: undefined,
      search: undefined,
      level: undefined,
      category: undefined,
      merchant_id: undefined,
      file_format: undefined,
      sort: 'terbaru',
    });
  });

  it('trims text filters', () => {
    expect(parse({ category: ' Sipil ', search: ' rab ' })).toMatchObject({
      category: 'Sipil',
      search: 'rab',
    });
  });

  it('matches enum filters ignoring case and spaces', async () => {
    const query = parse({
      type: ' Kelas,BOOTCAMP ',
      level: ' mahir ',
      sort: 'Termurah',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      type: ['kelas', 'bootcamp'],
      level: 'Mahir',
      sort: 'termurah',
    });
  });

  it('rejects unknown enum values', async () => {
    expect(await errorFields({ type: 'kelas,webinar' })).toEqual(['type']);
    expect(await errorFields({ level: 'expert' })).toEqual(['level']);
    expect(await errorFields({ sort: 'cheapest' })).toEqual(['sort']);
  });
});
