import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { Voucher } from './entities/voucher.entity';
import { VoucherService } from './voucher.service';

describe('VoucherService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  const voucherId = '40000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let dataSource: {
    transaction: jest.Mock;
    manager: Record<string, jest.Mock>;
    query: jest.Mock;
  };
  let service: VoucherService;

  const voucherRow = {
    id: voucherId,
    merchant_id: merchantId,
    name: 'Welcome voucher',
    code: 'WELCOME15',
    description: null,
    terms: null,
    discount_type: 'percentage',
    discount_value: '15',
    minimum_order_amount: null,
    maximum_discount_amount: null,
    max_uses: null,
    starts_at: null,
    expires_at: null,
    is_active: true,
    created_at: new Date('2026-09-18T00:00:00.000Z'),
    usage_count: '0',
  };

  const publicVoucherRow = {
    id: voucherId,
    name: 'Welcome voucher',
    code: 'WELCOME15',
    description: null,
    discount_type: 'percentage',
    discount_value: '15',
    minimum_order_amount: null,
    maximum_discount_amount: '50000',
    expires_at: null,
    merchant_id: merchantId,
    merchant_name: 'Akademi Teknik Raka',
    merchant_slug: 'akademi-teknik-raka',
    merchant_avatar_asset_id: null,
    merchant_tagline: null,
    merchant_category_label: 'Pemrograman & IT',
  };

  beforeEach(() => {
    manager = {
      create: jest.fn((target, value) =>
        target === Voucher ? { ...value, id: voucherId } : value,
      ),
      findOne: jest.fn().mockResolvedValue({ id: merchantId, userId }),
      query: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (_target, value) => value),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      manager,
      query: jest.fn().mockResolvedValue([voucherRow]),
    };
    service = new VoucherService(dataSource as unknown as DataSource);
  });

  it('creates a store-wide voucher with a normalized code and no product scope', async () => {
    await expect(
      service.create(userId, {
        name: 'Welcome voucher',
        code: ' welcome15 ',
        discount_type: 'percentage',
        discount_value: 15,
      }),
    ).resolves.toMatchObject({
      responseMessage: 'Create voucher success',
      data: { code: 'WELCOME15', discount_value: 15 },
    });

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      Voucher,
      expect.objectContaining({ merchantId, code: 'WELCOME15' }),
    );
  });

  it('rejects a create payload that still contains product_ids', async () => {
    await expect(
      service.create(userId, {
        name: 'Welcome voucher',
        code: 'WELCOME15',
        discount_type: 'percentage',
        discount_value: 15,
        product_ids: ['30000000-0000-4000-8000-000000000001'],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an update payload that still contains product_ids', async () => {
    await expect(
      service.update(userId, voucherId, {
        product_ids: ['30000000-0000-4000-8000-000000000001'],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('searches public vouchers across voucher fields and the store name', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await expect(service.findPublic({ search: 'raka' })).resolves.toMatchObject(
      {
        responseMessage: 'Get public vouchers success',
        data: [
          {
            id: voucherId,
            code: 'WELCOME15',
            discount_value: 15,
            merchant_category_slug: 'pemrograman-it',
          },
        ],
      },
    );

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('merchant.store_name ILIKE'),
      expect.any(Array),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.not.stringContaining('coupon_product_scopes'),
      expect.any(Array),
    );
  });

  it('exposes the discount cap on public and featured vouchers', async () => {
    const uncappedRow = {
      ...publicVoucherRow,
      id: '11111111-1111-4111-8111-111111111111',
      maximum_discount_amount: null,
    };
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow, uncappedRow]);
      return Promise.resolve([{ total: '2' }]);
    });

    const page = await service.findPublic({});

    expect(page.data[0]).toMatchObject({
      id: voucherId,
      maximum_discount_amount: 50000,
    });
    expect(page.data[1]).toMatchObject({
      maximum_discount_amount: null,
    });

    const featured = await service.findFeatured();

    expect(featured.data[0]).toMatchObject({
      maximum_discount_amount: 50000,
    });
  });

  it('picks featured and promo vouchers randomly with their tag', async () => {
    dataSource.query.mockResolvedValue([
      { ...publicVoucherRow, tag: 'PROMO SUPER' },
    ]);

    const featured = await service.findFeatured();
    const promo = await service.findRandomPublic(6);

    expect(featured.data[0]).toMatchObject({
      id: voucherId,
      tag: 'PROMO SUPER',
    });
    expect(promo[0]).toMatchObject({ tag: 'PROMO SUPER' });
    const [[featuredSql, featuredParams], [, promoParams]] =
      dataSource.query.mock.calls;
    expect(featuredSql).toContain('ORDER BY random()');
    expect(featuredSql).toContain('hashtext(coupon.id::text)');
    expect(featuredParams.slice(4)).toEqual([3, 0, null]);
    expect(promoParams.slice(4)).toEqual([6, 0, null]);
  });

  it('returns a null category slug for a merchant without a canonical category', () => {
    const response = (
      service as unknown as {
        toPublicVoucherResponse: (row: typeof publicVoucherRow) => {
          merchant_category_slug: string | null;
        };
      }
    ).toPublicVoucherResponse({
      ...publicVoucherRow,
      merchant_category_label: null,
    });

    expect(response.merchant_category_slug).toBeNull();
  });

  it('filters public vouchers by the merchant category matching the slug', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await service.findPublic({ category_slug: 'pemrograman-it' });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('profile.category_label = $3'),
      expect.arrayContaining(['Pemrograman & IT']),
    );
  });

  it('returns an empty page for a category slug outside the canonical list', async () => {
    await expect(
      service.findPublic({ category_slug: 'kuliner-jasa' }),
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPage: 0 },
      responseMessage: 'Get public vouchers success',
    });

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('filters public vouchers by the merchant slug', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await service.findPublic({ merchant_slug: 'akademi-teknik-raka' });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('profile.slug = $4'),
      expect.arrayContaining(['akademi-teknik-raka']),
    );
  });

  it('filters public vouchers by the merchant id', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await service.findPublic({ merchant_id: merchantId });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('merchant.id = $7'),
      expect.arrayContaining([merchantId]),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('merchant.id = $5'),
      expect.arrayContaining([merchantId]),
    );
  });

  it.each([
    ['inactive', { is_active: false }],
    ['scheduled', { starts_at: new Date('2999-01-01T00:00:00.000Z') }],
    ['expired', { expires_at: new Date('2000-01-01T00:00:00.000Z') }],
    ['limit_reached', { max_uses: 1, usage_count: '1' }],
    ['active', {}],
  ])('derives the %s merchant status', (status, changes) => {
    const response = (
      service as unknown as {
        toVoucherResponse: (row: typeof voucherRow) => { status: string };
      }
    ).toVoucherResponse({ ...voucherRow, ...changes });

    expect(response.status).toBe(status);
  });

  it('rejects a percentage above 100 before entering a transaction', async () => {
    await expect(
      service.create(userId, {
        name: 'Invalid voucher',
        code: 'INVALID101',
        discount_type: 'percentage',
        discount_value: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('voucher DTOs', () => {
  const valid = {
    name: 'Voucher Pengguna Baru',
    code: 'NEWSTUDENT15',
    discount_type: 'percentage',
    discount_value: 15,
  };
  const errorFields = async (target: new () => object, input: object) =>
    (await validate(plainToInstance(target, input))).map(
      (error) => error.property,
    );

  it('accepts numeric strings and stores the discount type canonically', async () => {
    const dto = plainToInstance(CreateVoucherDto, {
      ...valid,
      discount_type: ' Nominal ',
      discount_value: '15000',
      minimum_order_amount: '50000',
      maximum_discount_amount: '',
      max_uses: '200',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      discount_type: 'nominal',
      discount_value: 15000,
      minimum_order_amount: 50000,
      max_uses: 200,
    });
    expect(dto.maximum_discount_amount).toBeUndefined();
  });

  it('treats a usage limit of 0 as unlimited', async () => {
    for (const max_uses of [0, '0']) {
      const dto = plainToInstance(CreateVoucherDto, { ...valid, max_uses });
      expect(await validate(dto)).toEqual([]);
      expect(dto.max_uses).toBeNull();
    }
  });

  it('clears the description and terms with "" or null', async () => {
    const dto = plainToInstance(UpdateVoucherDto, {
      description: '  ',
      terms: null,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ description: null, terms: null });
  });

  it.each(['', '  ', null])('rejects a name or code of %j', async (value) => {
    expect(
      await errorFields(CreateVoucherDto, {
        ...valid,
        name: value,
        code: value,
      }),
    ).toEqual(['name', 'code']);
    expect(
      await errorFields(UpdateVoucherDto, { name: value, code: value }),
    ).toEqual(['name', 'code']);
  });

  it('rejects clearing a required number on update', async () => {
    expect(
      await errorFields(UpdateVoucherDto, { discount_value: null }),
    ).toEqual(['discount_value']);
  });
});
