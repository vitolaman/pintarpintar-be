import { plainToInstance, Transform } from 'class-transformer';
import { IsOptional, IsString, validate } from 'class-validator';
import { OptionalNotNull } from '../decorator/optional-not-null.decorator';
import { escapeLike } from '../util/escape-like';
import { RequestPaginatedQueryDto } from './request-paginated.dto';
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

const errorsOf = async (target: new () => object, input: object) =>
  (await validate(plainToInstance(target, input))).map(
    (error) => error.property,
  );

describe('request validation helpers', () => {
  it.each([
    [{ page: '0' }, ['page']],
    [{ limit: '0' }, ['limit']],
    [{ limit: '101' }, ['limit']],
    [{ page: 'abc' }, ['page']],
    [{ page: '2', limit: '100' }, []],
    [{}, []],
  ])('paging %j fails on %j', async (input, fields) => {
    expect(await errorsOf(RequestPaginatedQueryDto, input)).toEqual(fields);
  });

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
