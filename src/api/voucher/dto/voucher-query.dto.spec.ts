import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicVoucherQueryDto } from './voucher-query.dto';

const MERCHANT_ID = '50000000-0000-4000-8000-000000000001';

describe('PublicVoucherQueryDto', () => {
  const parse = (input: object) =>
    plainToInstance(PublicVoucherQueryDto, input);
  const errorFields = async (input: object) =>
    (await validate(parse(input))).map((error) => error.property);

  it('treats blank filters as no filter', async () => {
    const query = parse({
      search: '',
      category_slug: '',
      merchant_slug: '  ',
      merchant_id: '',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      search: undefined,
      category_slug: undefined,
      merchant_slug: undefined,
      merchant_id: undefined,
    });
  });

  it('trims the filters', async () => {
    const query = parse({
      category_slug: ' teknik-arsitektur ',
      merchant_id: ` ${MERCHANT_ID} `,
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      category_slug: 'teknik-arsitektur',
      merchant_id: MERCHANT_ID,
    });
  });

  it('still rejects a malformed slug or merchant id', async () => {
    expect(await errorFields({ category_slug: 'Teknik Sipil' })).toEqual([
      'category_slug',
    ]);
    expect(await errorFields({ merchant_id: 'toko' })).toEqual(['merchant_id']);
  });
});
