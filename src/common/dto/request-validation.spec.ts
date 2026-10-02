import { plainToInstance, Transform } from 'class-transformer';
import { IsOptional, IsString, validate } from 'class-validator';
import { OptionalNotNull } from '../decorator/optional-not-null.decorator';
import { escapeLike } from '../util/escape-like';
import {
  LimitQuery,
  PageQuery,
  RequestPaginatedQueryDto,
} from './request-paginated.dto';
import { paginationMeta } from './response-meta.dto';
import { trimOptionalText, trimText } from './text-transforms';

class SampleDto {
  @OptionalNotNull()
  @IsString()
  @Transform(trimText)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  tagline?: string | null;
}

class SmallListQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery({ defaultLimit: 6, maxLimit: 6 })
  limit?: number = 6;
}

class CompleteListQueryDto {
  @LimitQuery({ defaultLimit: undefined })
  limit?: number;
}

const errorsOf = async (target: new () => object, input: object) =>
  (await validate(plainToInstance(target, input))).map(
    (error) => error.property,
  );

describe('request validation helpers', () => {
  it.each([
    [{}, 1, 10],
    [{ page: '', limit: '' }, 1, 10],
    [{ page: '  ', limit: ' ' }, 1, 10],
    [{ page: 'abc', limit: 'x' }, 1, 10],
    [{ page: '0', limit: '0' }, 1, 1],
    [{ page: '-2', limit: '-5' }, 1, 1],
    [{ page: '2.7', limit: '20.9' }, 2, 20],
    [{ limit: '101' }, 1, 100],
    [{ page: '1e30', limit: 'Infinity' }, 1_000_000, 10],
    [{ page: ['2', '3'] }, 1, 10],
    [{ page: '3', limit: '25' }, 3, 25],
  ])('paging %j becomes page %d, limit %d', async (input, page, limit) => {
    const query = plainToInstance(RequestPaginatedQueryDto, input);
    expect(query).toMatchObject({ page, limit });
    expect(await validate(query)).toEqual([]);
  });

  it('clamps to a smaller list maximum and keeps its default', () => {
    expect(plainToInstance(SmallListQueryDto, { limit: '50' }).limit).toBe(6);
    expect(plainToInstance(SmallListQueryDto, { limit: '' }).limit).toBe(6);
    expect(plainToInstance(SmallListQueryDto, {}).limit).toBe(6);
  });

  it('leaves the limit unset for a complete list unless one is sent', () => {
    expect(plainToInstance(CompleteListQueryDto, {}).limit).toBeUndefined();
    expect(plainToInstance(CompleteListQueryDto, { limit: '' }).limit).toBe(
      undefined,
    );
    expect(plainToInstance(CompleteListQueryDto, { limit: '2' }).limit).toBe(2);
  });

  it.each([
    [1, 2, 5, { page: 1, limit: 2, total: 5, totalPage: 3 }],
    [1, 10, 0, { page: 1, limit: 10, total: 0, totalPage: 0 }],
    [4, 10, 30, { page: 4, limit: 10, total: 30, totalPage: 3 }],
  ])(
    'builds meta for page %d, limit %d, total %d',
    (page, limit, total, meta) => {
      expect(paginationMeta(page, limit, total)).toEqual(meta);
    },
  );

  it.each([
    [{ name: null }, ['name']],
    [{ name: ['x'] }, ['name']],
    [{ name: { x: 1 } }, ['name']],
    [{ tagline: [] }, ['tagline']],
    [{ name: '  Budi ', tagline: null }, []],
    [{}, []],
  ])('fields %j fail on %j', async (input, fields) => {
    expect(await errorsOf(SampleDto, input)).toEqual(fields);
  });

  it('trims text and treats blank optional text as unchanged', () => {
    const dto = plainToInstance(SampleDto, { name: '  Budi ', tagline: '   ' });
    expect(dto.name).toBe('Budi');
    expect(dto.tagline).toBeUndefined();
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
