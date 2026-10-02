import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  canonicalValue,
  ClearableText,
  EnumInput,
  NumberInput,
  QueryFilter,
  RequiredText,
} from './input.decorator';

const levels = ['Pemula', 'Menengah', 'Mahir'] as const;

class SampleDto {
  @ClearableText({ max: 10 })
  headline?: string | null;

  @RequiredText({ max: 10 })
  title: string;

  @RequiredText({ max: 10, optional: true })
  name?: string;

  @EnumInput(levels, { presence: 'optional' })
  level?: string;

  @EnumInput(levels, { presence: 'nullable' })
  category?: string | null;

  @NumberInput({ presence: 'optional', integer: true, min: 0 })
  years?: number;

  @NumberInput({ presence: 'nullable', min: 0 })
  minimum?: number | null;
}

class SortedFilterDto {
  @EnumInput(['terbaru', 'harga'], { presence: 'filter', default: 'terbaru' })
  sort: string = 'terbaru';
}

class FilterDto {
  @QueryFilter()
  search?: string;

  @EnumInput(levels, { presence: 'filter' })
  level?: string;
}

const parse = (input: object) =>
  plainToInstance(SampleDto, { title: 'Judul', ...input });
const errorFields = async (input: object) =>
  (await validate(parse(input))).map((error) => error.property);

describe('input decorators', () => {
  it.each([
    ['', null],
    ['   ', null],
    [null, null],
    ['  Halo ', 'Halo'],
  ])('clearable text %j becomes %j', async (headline, expected) => {
    const dto = parse({ headline });
    expect(dto.headline).toBe(expected);
    expect(await validate(dto)).toEqual([]);
  });

  it('leaves omitted clearable text undefined', () => {
    expect(parse({}).headline).toBeUndefined();
  });

  it('rejects clearable text of the wrong type or length', async () => {
    expect(await errorFields({ headline: 5 })).toEqual(['headline']);
    expect(await errorFields({ headline: 'x'.repeat(11) })).toEqual([
      'headline',
    ]);
  });

  it.each([[''], ['   '], [null], [undefined], [42]])(
    'required text rejects %j',
    async (title) => {
      expect(await errorFields({ title })).toEqual(['title']);
    },
  );

  it('optional required text may be omitted but not blanked or nulled', async () => {
    expect(await errorFields({})).toEqual([]);
    expect(await errorFields({ name: '' })).toEqual(['name']);
    expect(await errorFields({ name: null })).toEqual(['name']);
    expect(parse({ name: '  Budi ' }).name).toBe('Budi');
  });

  it.each([
    ['mahir', 'Mahir'],
    ['  MENENGAH ', 'Menengah'],
    ['Pemula', 'Pemula'],
  ])('enum %j is stored as %j', async (level, expected) => {
    const dto = parse({ level });
    expect(dto.level).toBe(expected);
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects an unknown enum value and a null for a non-nullable enum', async () => {
    expect(await errorFields({ level: 'expert' })).toEqual(['level']);
    expect(await errorFields({ level: null })).toEqual(['level']);
  });

  it('clears a nullable enum with "" or null', async () => {
    expect(parse({ category: '' }).category).toBeNull();
    expect(parse({ category: null }).category).toBeNull();
    expect(await errorFields({ category: '' })).toEqual([]);
  });

  it.each([
    ['3', 3],
    [' 12 ', 12],
    [7, 7],
    ['', undefined],
  ])('number %j becomes %j', async (years, expected) => {
    const dto = parse({ years });
    expect(dto.years).toBe(expected);
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects non-numeric, fractional and negative numbers', async () => {
    expect(await errorFields({ years: 'abc' })).toEqual(['years']);
    expect(await errorFields({ years: '1.5' })).toEqual(['years']);
    expect(await errorFields({ years: -1 })).toEqual(['years']);
    expect(await errorFields({ years: null })).toEqual(['years']);
  });

  it('clears a nullable number with null and ignores a blank one', async () => {
    expect(parse({ minimum: null }).minimum).toBeNull();
    expect(parse({ minimum: '' }).minimum).toBeUndefined();
    expect(parse({ minimum: '2500.5' }).minimum).toBe(2500.5);
    expect(await errorFields({ minimum: null })).toEqual([]);
  });

  it('treats blank query filters as no filter', async () => {
    const dto = plainToInstance(FilterDto, { search: '  ', level: '' });
    expect(dto).toEqual({ search: undefined, level: undefined });
    expect(await validate(dto)).toEqual([]);
    const filled = plainToInstance(FilterDto, {
      search: ' rab ',
      level: 'MAHIR',
    });
    expect(filled).toEqual({ search: 'rab', level: 'Mahir' });
  });

  it('keeps the documented default for a blank filter that has one', () => {
    expect(plainToInstance(SortedFilterDto, { sort: '' }).sort).toBe('terbaru');
    expect(plainToInstance(SortedFilterDto, {}).sort).toBe('terbaru');
    expect(plainToInstance(SortedFilterDto, { sort: 'HARGA' }).sort).toBe(
      'harga',
    );
  });

  it('keeps every enum distinct when case is ignored', () => {
    expect(canonicalValue(levels, 'mahir')).toBe('Mahir');
    expect(canonicalValue(['a', 'b'], 'C')).toBe('C');
  });
});
