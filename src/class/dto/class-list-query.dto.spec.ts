import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassStatus } from '../entities/class.entity';
import { ClassListQueryDto } from './class-list-query.dto';

describe('ClassListQueryDto', () => {
  const parse = (input: object) => plainToInstance(ClassListQueryDto, input);
  const errorFields = async (input: object) =>
    (await validate(parse(input))).map((error) => error.property);

  it('treats a blank status or type as no filter', async () => {
    const query = parse({ status: '', type: '  ' });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ status: undefined, type: undefined });
  });

  it('matches status and type ignoring case and spaces', async () => {
    const query = parse({ status: ' Published ', type: ' BOOTCAMP' });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      status: ClassStatus.PUBLISHED,
      type: 'bootcamp',
    });
  });

  it('rejects an unknown status or type', async () => {
    expect(await errorFields({ status: 'unlisted' })).toEqual(['status']);
    expect(await errorFields({ type: 'kelas-video' })).toEqual(['type']);
    expect(await errorFields({ type: 'video' })).toEqual(['type']);
    expect(await errorFields({ type: 'live-bootcamp' })).toEqual(['type']);
  });
});
