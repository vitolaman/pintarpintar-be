import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PromoItemsQueryDto } from './promo.dto';

describe('PromoItemsQueryDto', () => {
  const parse = (input: object) => plainToInstance(PromoItemsQueryDto, input);
  const errorFields = async (input: object) =>
    (await validate(parse(input))).map((error) => error.property);

  it('treats a blank type as classes and a blank sort as a random pick', async () => {
    const query = parse({ type: '', sort: ' ' });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ type: 'kelas', sort: undefined });
  });

  it('matches type and sort ignoring case and spaces', async () => {
    const query = parse({ type: ' Digital ', sort: 'TERPOPULER' });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ type: 'digital', sort: 'terpopuler' });
  });

  it('rejects an unknown type or sort', async () => {
    expect(await errorFields({ type: 'bundle' })).toEqual(['type']);
    expect(await errorFields({ sort: 'cheapest' })).toEqual(['sort']);
  });
});
