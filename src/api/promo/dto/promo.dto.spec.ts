import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PromoItemsQueryDto } from './promo.dto';

describe('PromoItemsQueryDto', () => {
  const parse = (input: object) => plainToInstance(PromoItemsQueryDto, input);
  const errorFields = async (input: object) =>
    (await validate(parse(input))).map((error) => error.property);

  it('treats a blank type as classes and bootcamps and no sort as a random pick', async () => {
    const query = parse({ type: '', sort_by: ' ' });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      type: ['kelas', 'bootcamp'],
      sort_by: undefined,
    });
    expect(parse({}).type).toEqual(['kelas', 'bootcamp']);
  });

  it('takes comma-separated catalog types and a sort, ignoring case', async () => {
    const query = parse({ type: ' Digital ', sort_by: 'POPULARITY' });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ type: ['digital'], sort_by: 'popularity' });
    expect(parse({ type: 'kelas, Bootcamp' }).type).toEqual([
      'kelas',
      'bootcamp',
    ]);
  });

  it('rejects an unknown type or sort', async () => {
    expect(await errorFields({ type: 'bundle' })).toEqual(['type']);
    expect(await errorFields({ sort_by: 'cheapest' })).toEqual(['sort_by']);
  });
});
