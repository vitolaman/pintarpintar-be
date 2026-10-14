import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  canonicalValue,
  ClearableText,
  EnumInput,
  FormLabel,
  NumberInput,
  PhoneInput,
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

class LabelDto {
  @FormLabel({ max: 10 })
  kind: string;

  @FormLabel({ presence: 'optional', max: 10 })
  role?: string;

  @FormLabel({ presence: 'nullable', max: 20 })
  field?: string | null;
}

const parseLabels = (input: object) =>
  plainToInstance(LabelDto, { kind: 'Kreator', ...input });
const labelErrors = async (input: object) =>
  (await validate(parseLabels(input))).map((error) => error.property);

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

  it.each([
    ['<b>Brand</b>', 'Brand'],
    ['  Content Creator ', 'Content Creator'],
    ['Brand > Kreator', 'Brand  Kreator'],
    ['Tab\tdan\u0000', 'Tabdan'],
  ])('cleans the label %j to %j', (input, expected) => {
    expect(parseLabels({ kind: input }).kind).toBe(expected);
  });

  it('keeps an ampersand in a label', async () => {
    const dto = parseLabels({ field: 'Desain & Kreatif' });
    expect(dto.field).toBe('Desain & Kreatif');
    expect(await validate(dto)).toEqual([]);
  });

  it('stores any label without a fixed list', async () => {
    expect(await labelErrors({ kind: 'mahasiswa', role: 'ibu_rt' })).toEqual(
      [],
    );
  });

  it.each([
    [{ kind: '' }, 'kind'],
    [{ kind: '<b></b>' }, 'kind'],
    [{ kind: 'x'.repeat(11) }, 'kind'],
    [{ kind: 5 }, 'kind'],
    [{ role: null }, 'role'],
    [{ role: '   ' }, 'role'],
    [{ field: 7 }, 'field'],
  ])('rejects the label input %j', async (input, field) => {
    expect(await labelErrors(input)).toEqual([field]);
  });

  it('clears a nullable label that is blank or empty after cleanup', async () => {
    expect(parseLabels({ field: '  ' }).field).toBeNull();
    expect(parseLabels({ field: '<i></i>' }).field).toBeNull();
    expect(parseLabels({ field: null }).field).toBeNull();
    expect(await labelErrors({ field: null })).toEqual([]);
    expect(parseLabels({}).role).toBeUndefined();
    expect(await labelErrors({})).toEqual([]);
  });
});

class PhoneDto {
  @PhoneInput()
  phone: string;

  @PhoneInput({ presence: 'nullable' })
  contact?: string | null;

  @PhoneInput({ presence: 'optional' })
  backup?: string;
}

describe('PhoneInput', () => {
  const parse = (input: object) => plainToInstance(PhoneDto, input);
  const errors = async (input: object) =>
    (await validate(parse(input))).map((error) => error.property);

  it('stores every common format as digits with the country code', async () => {
    const dto = parse({
      phone: '0812-3456-7890',
      contact: '+62 0812 3456 7890',
      backup: '+65 9123 4567',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      phone: '6281234567890',
      contact: '6281234567890',
      backup: '6591234567',
    });
  });

  it.each(['12345', '0812abc', '', '   ', null, 812])(
    'rejects a required phone of %j',
    async (phone) => {
      expect(await errors({ phone })).toEqual(['phone']);
    },
  );

  it('clears a nullable phone with "" or null and rejects null for an optional one', async () => {
    expect(parse({ phone: '0812 3456 7890', contact: '' }).contact).toBeNull();
    expect(await errors({ phone: '0812 3456 7890', contact: null })).toEqual(
      [],
    );
    expect(await errors({ phone: '0812 3456 7890', backup: null })).toEqual([
      'backup',
    ]);
    expect(await errors({ phone: '0812 3456 7890' })).toEqual([]);
  });

  it('names the rule in the message', async () => {
    const [error] = await validate(parse({ phone: '123' }));
    expect(Object.values(error.constraints ?? {})).toContain(
      'phone must be a phone number of 8 to 15 digits',
    );
  });
});
