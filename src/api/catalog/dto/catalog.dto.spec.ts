import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { catalogSort, CatalogQueryDto } from './catalog.dto';

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
      sub: '',
      merchant_id: '',
      file_format: '',
      sort_by: '',
      sort_order: '',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      type: undefined,
      search: undefined,
      level: undefined,
      category: undefined,
      sub: undefined,
      merchant_id: undefined,
      file_format: undefined,
      sort_by: 'created_at',
      sort_order: undefined,
    });
  });

  it('trims text filters', () => {
    expect(
      parse({ category: ' Sipil ', sub: ' Video Effect ', search: ' rab ' }),
    ).toMatchObject({
      category: 'Sipil',
      sub: 'Video Effect',
      search: 'rab',
    });
  });

  it('matches enum filters ignoring case and spaces', async () => {
    const query = parse({
      type: ' Kelas,BOOTCAMP ',
      level: ' mahir ',
      sort_by: 'Price',
      sort_order: ' DESC ',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      type: ['kelas', 'bootcamp'],
      level: 'Mahir',
      sort_by: 'price',
      sort_order: 'desc',
    });
  });

  it('rejects unknown enum values', async () => {
    expect(await errorFields({ type: 'kelas,webinar' })).toEqual(['type']);
    expect(await errorFields({ level: 'expert' })).toEqual(['level']);
    expect(await errorFields({ sort_by: 'cheapest' })).toEqual(['sort_by']);
    expect(await errorFields({ sort_order: 'up' })).toEqual(['sort_order']);
  });

  it('keeps the frontend filter "Kelas Live" as an accepted value', async () => {
    expect(await errorFields({ type: 'kelas-live' })).toEqual([]);
  });

  it('rejects the old sort parameter as an unknown field', async () => {
    const errors = await validate(parse({ sort: 'terbaru' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toEqual(['sort']);
  });

  it.each([
    ['created_at', undefined, { by: 'created_at', order: 'desc' }],
    ['popularity', undefined, { by: 'popularity', order: 'desc' }],
    ['price', undefined, { by: 'price', order: 'asc' }],
    ['rating', undefined, { by: 'rating', order: 'desc' }],
    ['title', undefined, { by: 'title', order: 'asc' }],
    ['price', 'desc', { by: 'price', order: 'desc' }],
    [undefined, undefined, { by: 'created_at', order: 'desc' }],
  ])('sorts by %s %s as %j', (by, order, expected) => {
    expect(catalogSort(by as never, order as never)).toEqual(expected);
  });
});
