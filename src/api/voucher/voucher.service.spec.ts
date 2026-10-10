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
    minimum_purchase: null,
    maximum_discount_amount: null,
    usage_limit: null,
    starts_at: null,
    ends_at: null,
    is_active: true,
    created_at: new Date('2026-09-18T00:00:00.000Z'),
    used_count: '0',
  };

  const publicVoucherRow = {
    id: voucherId,
    name: 'Welcome voucher',
    code: 'WELCOME15',
    description: null,
    discount_type: 'percentage',
    discount_value: '15',
    minimum_purchase: null,
    maximum_discount_amount: '50000',
    ends_at: null,
    merchant_id: merchantId,
    merchant_name: 'Akademi Teknik Raka',
    merchant_slug: 'akademi-teknik-raka',
    merchant_avatar_object_key: null,
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

  it('adds the merchant avatar URL to public, featured and promo vouchers', async () => {
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      const logoRow = {
        ...publicVoucherRow,
        merchant_avatar_object_key: 'merchants/raka/logo.png',
      };
      dataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('WITH visible') && !sql.includes('COUNT(*)'))
          return Promise.resolve([logoRow, publicVoucherRow]);
        return Promise.resolve([{ total: '2' }]);
      });

      const page = await service.findPublic({});
      const featured = await service.findFeatured();
      const promo = await service.findRandomPublic(2);

      const logoUrl = 'https://cdn.example.com/merchants/raka/logo.png';
      expect(page.data.map((voucher) => voucher.merchant_avatar_url)).toEqual([
        logoUrl,
        null,
      ]);
      expect(page.data[0]).not.toHaveProperty('merchant_avatar_asset_id');
      expect(page.data[0]).not.toHaveProperty('merchant_avatar_object_key');
      expect(featured.data[0].merchant_avatar_url).toBe(logoUrl);
      expect(promo[0].merchant_avatar_url).toBe(logoUrl);
      const [rowsSql] = dataSource.query.mock.calls[0];
      expect(rowsSql).toContain(
        'LEFT JOIN file_assets avatar\n          ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL',
      );
    } finally {
      delete process.env.ASSET_PUBLIC_BASE_URL;
    }
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
    expect(featuredParams.slice(7)).toEqual([null, 'any', 3, 0]);
    expect(promoParams.slice(7)).toEqual([null, 'any', 6, 0]);
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
      meta: { page: 1, limit: 10, total: 0, total_page: 0 },
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

    const calls = dataSource.query.mock.calls as Array<[string, unknown[]]>;
    expect(calls).toHaveLength(2);
    for (const [sql, params] of calls) {
      expect(sql).toContain('merchant.id = $5');
      expect(params[4]).toBe(merchantId);
    }
  });

  it("marks the viewer's claims on public vouchers and none without a token", async () => {
    dataSource.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('COUNT(*)')
          ? [{ total: 1 }]
          : [{ ...publicVoucherRow, is_claimed: true }],
      ),
    );

    const signedIn = await service.findPublic({}, userId);
    await service.findPublic({});

    expect(signedIn.data[0].is_claimed).toBe(true);
    const [[rowsSql, viewerParams], , [, guestParams]] = dataSource.query.mock
      .calls as Array<[string, unknown[]]>;
    expect(rowsSql).toContain('claim.id IS NOT NULL AS is_claimed');
    expect(rowsSql).toContain('claim.user_id = $8::uuid');
    expect(viewerParams[7]).toBe(userId);
    expect(guestParams[7]).toBeNull();
  });

  it('lists only claimed vouchers, newest claim first', async () => {
    dataSource.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('COUNT(*)')
          ? [{ total: 1 }]
          : [{ ...publicVoucherRow, is_claimed: true }],
      ),
    );

    const response = await service.findClaimed(userId, 1, 10);

    expect(response.meta).toMatchObject({ total: 1 });
    const [[sql, params]] = dataSource.query.mock.calls as Array<
      [string, unknown[]]
    >;
    expect(sql).toContain('ORDER BY claim.created_at DESC NULLS LAST');
    expect(params.slice(7)).toEqual([userId, 'claimed', 10, 0]);
  });

  it('claims a usable voucher once without reserving a use', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const builder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute,
    };
    Object.assign(dataSource, { createQueryBuilder: () => builder });
    dataSource.query.mockResolvedValue([
      { ...publicVoucherRow, is_claimed: false },
    ]);

    const response = await service.claim(userId, voucherId);

    expect(response.data).toMatchObject({ id: voucherId, is_claimed: true });
    expect(builder.values).toHaveBeenCalledWith({
      userId,
      couponId: voucherId,
    });
    expect(builder.orIgnore).toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    const [[sql, params]] = dataSource.query.mock.calls as Array<
      [string, unknown[]]
    >;
    expect(sql).not.toContain('INSERT');
    expect(params[6]).toBe(voucherId);
  });

  it('refuses to claim a voucher that is not usable', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(service.claim(userId, voucherId)).rejects.toThrow(
      'Voucher not found',
    );
  });

  it("unclaims only the caller's live claim", async () => {
    await service.unclaim(userId, voucherId);

    expect(manager.softDelete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId, couponId: voucherId }),
    );
  });

  it("splits the checkout merchants' vouchers by the buyer's claims", async () => {
    dataSource.query.mockResolvedValue([
      { ...publicVoucherRow, id: 'claimed', is_claimed: true },
      { ...publicVoucherRow, id: 'other', is_claimed: false },
    ]);

    const vouchers = await service.checkoutVouchers(userId, [merchantId]);

    expect(vouchers.claimed.map((voucher) => voucher.id)).toEqual(['claimed']);
    expect(vouchers.recommended.map((voucher) => voucher.id)).toEqual([
      'other',
    ]);
    const [[sql, params]] = dataSource.query.mock.calls as Array<
      [string, unknown[]]
    >;
    expect(sql).toContain('coupon.merchant_id = ANY($6::uuid[])');
    expect(params[5]).toEqual([merchantId]);
    expect(params.slice(7)).toEqual([userId, 'any', null, 0]);
  });

  it('skips the voucher query when no merchant is selected', async () => {
    await expect(service.checkoutVouchers(userId, [])).resolves.toEqual({
      claimed: [],
      recommended: [],
    });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', { is_active: false }],
    ['scheduled', { starts_at: new Date('2999-01-01T00:00:00.000Z') }],
    ['expired', { ends_at: new Date('2000-01-01T00:00:00.000Z') }],
    ['limit_reached', { usage_limit: 1, used_count: '1' }],
    ['active', {}],
  ])('derives the %s merchant status', (status, changes) => {
    const response = (
      service as unknown as {
        toVoucherResponse: (row: typeof voucherRow) => { status: string };
      }
    ).toVoucherResponse({ ...voucherRow, ...changes });

    expect(response.status).toBe(status);
  });

  it('saves minimum_purchase, usage_limit and ends_at and returns them with used_count', async () => {
    dataSource.query.mockResolvedValue([
      {
        ...voucherRow,
        minimum_purchase: '50000',
        usage_limit: 200,
        ends_at: new Date('2026-12-31T23:59:59.000Z'),
        used_count: '3',
      },
    ]);

    const response = await service.create(userId, {
      name: 'Welcome voucher',
      code: 'WELCOME15',
      discount_type: 'percentage',
      discount_value: 15,
      minimum_purchase: 50000,
      usage_limit: 200,
      ends_at: '2026-12-31T23:59:59.000Z',
    });

    expect(manager.save).toHaveBeenCalledWith(
      Voucher,
      expect.objectContaining({
        minimumOrderAmount: '50000',
        maxUses: 200,
        expiresAt: new Date('2026-12-31T23:59:59.000Z'),
      }),
    );
    expect(response.data).toMatchObject({
      minimum_purchase: 50000,
      usage_limit: 200,
      ends_at: new Date('2026-12-31T23:59:59.000Z'),
      used_count: 3,
    });
    for (const oldName of [
      'minimum_order_amount',
      'max_uses',
      'usage_count',
      'expires_at',
    ]) {
      expect(response.data).not.toHaveProperty(oldName);
    }
    const [merchantSql] = dataSource.query.mock.calls[0];
    expect(merchantSql).toContain(
      'coupon.minimum_order_amount AS minimum_purchase',
    );
    expect(merchantSql).toContain('coupon.max_uses AS usage_limit');
    expect(merchantSql).toContain('coupon.expires_at AS ends_at');
    expect(merchantSql).toContain('AS used_count');
  });

  it('updates the renamed fields on the stored voucher', async () => {
    const stored = {
      id: voucherId,
      merchantId,
      discountType: 'percentage',
      discountValue: '15',
      startsAt: null,
      expiresAt: null,
    };
    manager.findOne
      .mockResolvedValueOnce({ id: merchantId, userId })
      .mockResolvedValueOnce(stored);

    await service.update(userId, voucherId, {
      minimum_purchase: 75000,
      usage_limit: 10,
      ends_at: '2026-12-31T23:59:59.000Z',
    });

    expect(manager.save).toHaveBeenCalledWith(
      Voucher,
      expect.objectContaining({
        minimumOrderAmount: '75000',
        maxUses: 10,
        expiresAt: new Date('2026-12-31T23:59:59.000Z'),
      }),
    );
  });

  it('returns the renamed fields on public vouchers', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible') && !sql.includes('COUNT(*)'))
        return Promise.resolve([
          {
            ...publicVoucherRow,
            minimum_purchase: '100000',
            ends_at: new Date('2026-12-31T23:59:59.000Z'),
          },
        ]);
      return Promise.resolve([{ total: '1' }]);
    });

    const page = await service.findPublic({});

    expect(page.data[0]).toMatchObject({
      minimum_purchase: 100000,
      ends_at: new Date('2026-12-31T23:59:59.000Z'),
    });
    expect(page.data[0]).not.toHaveProperty('minimum_order_amount');
    expect(page.data[0]).not.toHaveProperty('expires_at');
    const [rowsSql] = dataSource.query.mock.calls[0];
    expect(rowsSql).not.toContain('AS merchant_avatar_asset_id');
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
      minimum_purchase: '50000',
      maximum_discount_amount: '',
      usage_limit: '200',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      discount_type: 'nominal',
      discount_value: 15000,
      minimum_purchase: 50000,
      usage_limit: 200,
    });
    expect(dto.maximum_discount_amount).toBeUndefined();
  });

  it('treats a usage limit of 0 as unlimited', async () => {
    for (const usage_limit of [0, '0']) {
      const dto = plainToInstance(CreateVoucherDto, { ...valid, usage_limit });
      expect(await validate(dto)).toEqual([]);
      expect(dto.usage_limit).toBeNull();
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

  it.each([
    [CreateVoucherDto, 'minimum_order_amount', 50000],
    [CreateVoucherDto, 'max_uses', 10],
    [CreateVoucherDto, 'expires_at', '2026-12-31T23:59:59.000Z'],
    [UpdateVoucherDto, 'minimum_order_amount', 50000],
    [UpdateVoucherDto, 'max_uses', 10],
    [UpdateVoucherDto, 'expires_at', '2026-12-31T23:59:59.000Z'],
  ])(
    '%p rejects the old request field %s',
    async (target: new () => object, oldName: string, value: unknown) => {
      const body = target === CreateVoucherDto ? { ...valid } : {};
      const errors = await validate(
        plainToInstance(target, { ...body, [oldName]: value }),
        { whitelist: true, forbidNonWhitelisted: true },
      );

      expect(errors.map((error) => error.property)).toEqual([oldName]);
    },
  );

  it('accepts the renamed request fields under strict validation', async () => {
    const errors = await validate(
      plainToInstance(CreateVoucherDto, {
        ...valid,
        minimum_purchase: 50000,
        usage_limit: 10,
        starts_at: '2026-10-01T00:00:00.000Z',
        ends_at: '2026-12-31T23:59:59.000Z',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors).toEqual([]);
  });

  it('rejects clearing a required number on update', async () => {
    expect(
      await errorFields(UpdateVoucherDto, { discount_value: null }),
    ).toEqual(['discount_value']);
  });
});
