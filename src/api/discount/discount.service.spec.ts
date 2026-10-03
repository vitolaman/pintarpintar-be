import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager, FindOperator } from 'typeorm';
import { isPromoCodeAvailable } from '~/common/promo-code/promo-code-namespace';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  deriveStatus,
  DiscountService,
  generateDiscountCode,
} from './discount.service';
import {
  AddDiscountCodesDto,
  CreateDiscountDto,
  RemoveDiscountCodesDto,
  UpdateDiscountDto,
} from './dto/discount-request.dto';
import { DiscountCode } from './entities/discount-code.entity';
import { DiscountProduct } from './entities/discount-product.entity';
import { Discount } from './entities/discount.entity';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002';
const DISCOUNT_ID = '10000000-0000-4000-8000-000000000003';

const codeId = (index: number) =>
  `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

describe('generateDiscountCode', () => {
  it('uses the DSC prefix and an unambiguous alphabet', () => {
    for (let index = 0; index < 200; index++) {
      expect(generateDiscountCode()).toMatch(
        /^DSC-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/,
      );
    }
  });
});

describe('deriveStatus', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  it.each([
    ['inactive', { isActive: false, startsAt: null, endsAt: null }],
    [
      'scheduled',
      { isActive: true, startsAt: new Date('2026-10-01'), endsAt: null },
    ],
    [
      'expired',
      { isActive: true, startsAt: null, endsAt: new Date('2026-09-29') },
    ],
    ['active', { isActive: true, startsAt: null, endsAt: null }],
  ])('reports %s', (status, discount) => {
    expect(deriveStatus(discount, [], now)).toBe(status);
  });

  const live = { isActive: true, startsAt: null, endsAt: null };

  it('reports limit_reached when every code is used up', () => {
    const codes = [
      { usageLimit: 1, usedCount: 1 },
      { usageLimit: 5, usedCount: 5 },
    ];
    expect(deriveStatus(live, codes, now)).toBe('limit_reached');
  });

  it('stays active while one code still has uses or without codes', () => {
    const codes = [
      { usageLimit: 1, usedCount: 1 },
      { usageLimit: 5, usedCount: 4 },
    ];
    expect(deriveStatus(live, codes, now)).toBe('active');
    expect(deriveStatus(live, [], now)).toBe('active');
  });

  it('reports an ended or inactive discount before its used-up codes', () => {
    const codes = [{ usageLimit: 1, usedCount: 1 }];
    expect(
      deriveStatus({ ...live, endsAt: new Date('2026-09-29') }, codes, now),
    ).toBe('expired');
    expect(deriveStatus({ ...live, isActive: false }, codes, now)).toBe(
      'inactive',
    );
  });
});

describe('Discount DTOs', () => {
  const valid = {
    name: 'Diskon Kilat AutoCAD',
    discount_type: 'percentage',
    discount_value: 20,
  };

  it('accepts a discount without targets or codes', async () => {
    expect(
      await validate(plainToInstance(CreateDiscountDto, valid)),
    ).toHaveLength(0);
  });

  it.each([
    [{ discount_type: 'free' }],
    [{ discount_value: 0 }],
    [{ name: '' }],
    [{ targets: [{ type: 'bundle', id: CLASS_ID }] }],
    [{ codes: [{ code_type: 'once', usage_limit: 0 }] }],
    [{ codes: [{ code_type: 'forever', usage_limit: 10 }] }],
  ])('rejects %j', async (override) => {
    const dto = plainToInstance(CreateDiscountDto, { ...valid, ...override });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each(['', '  ', null])('rejects a name of %j', async (name) => {
    const create = plainToInstance(CreateDiscountDto, { ...valid, name });
    const update = plainToInstance(UpdateDiscountDto, { name });
    for (const dto of [create, update]) {
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toEqual(['name']);
    }
  });

  it('accepts numeric strings and matches enums ignoring case', async () => {
    const dto = plainToInstance(CreateDiscountDto, {
      ...valid,
      discount_type: ' Nominal ',
      discount_value: '25000',
      minimum_purchase: '100000.50',
      codes: [{ code_type: 'Once', usage_limit: '10' }],
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      discount_type: 'nominal',
      discount_value: 25000,
      minimum_purchase: 100000.5,
      codes: [{ code_type: 'once', usage_limit: 10 }],
    });
  });

  it('clears the minimum purchase with null and ignores a blank one', async () => {
    const cleared = plainToInstance(UpdateDiscountDto, {
      minimum_purchase: null,
    });
    expect(await validate(cleared)).toEqual([]);
    expect(cleared.minimum_purchase).toBeNull();

    const blank = plainToInstance(UpdateDiscountDto, { minimum_purchase: '' });
    expect(await validate(blank)).toEqual([]);
    expect(blank.minimum_purchase).toBeUndefined();
  });

  it('rejects clearing the discount type or value on update', async () => {
    const dto = plainToInstance(UpdateDiscountDto, {
      discount_type: null,
      discount_value: null,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual([
      'discount_type',
      'discount_value',
    ]);
  });

  it('rejects a client-supplied code string', async () => {
    const dto = plainToInstance(AddDiscountCodesDto, {
      codes: [{ code_type: 'once', usage_limit: 10, code: 'MYCODE' }],
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('RemoveDiscountCodesDto', () => {
  const errorsFor = (code_ids: unknown) =>
    validate(plainToInstance(RemoveDiscountCodesDto, { code_ids }));

  it('accepts 1 to 1,000 distinct code ids', async () => {
    expect(await errorsFor([codeId(1)])).toEqual([]);
    expect(
      await errorsFor(
        Array.from({ length: 1000 }, (_, index) => codeId(index)),
      ),
    ).toEqual([]);
  });

  it.each([
    ['no ids', []],
    ['more than 1,000 ids', Array.from({ length: 1001 }, (_, i) => codeId(i))],
    ['a repeated id', [codeId(1), codeId(1)]],
    ['a non-uuid id', ['DSC-ABCDEFGH']],
    ['a missing list', undefined],
  ])('rejects %s', async (_case, codeIds) => {
    expect(await errorsFor(codeIds)).not.toHaveLength(0);
  });
});

describe('isPromoCodeAvailable', () => {
  it('locks the code and checks vouchers and discount codes', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]);
    const manager = { query } as unknown as EntityManager;

    await expect(isPromoCodeAvailable(manager, 'hemat50k')).resolves.toBe(true);
    expect(query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_xact_lock(hashtext(upper($1)))',
      ['hemat50k'],
    ]);
    expect(query.mock.calls[1][0]).toContain('FROM coupons');
    expect(query.mock.calls[1][0]).toContain('FROM discount_codes');
  });

  it('reports a taken code', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{}]);
    await expect(
      isPromoCodeAvailable(
        { query } as unknown as EntityManager,
        'DSC-ABCDEFGH',
      ),
    ).resolves.toBe(false);
  });
});

describe('DiscountService', () => {
  const merchant = { id: 'merchant-id', userId: 'user-id' } as Merchant;
  let manager: Record<string, jest.Mock>;
  let dataSourceQuery: jest.Mock;
  let service: DiscountService;

  beforeEach(() => {
    dataSourceQuery = jest.fn(async () => []);
    manager = {
      findOne: jest.fn(async (target) =>
        target === Merchant ? merchant : null,
      ),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(async () => ({
        id: DISCOUNT_ID,
        name: 'Diskon',
        discountType: 'percentage',
        discountValue: '20',
        minimumPurchase: null,
        startsAt: null,
        endsAt: null,
        isActive: true,
        created_at: new Date(),
      })),
      find: jest.fn(async () => []),
      query: jest.fn(async (sql: string) =>
        sql.includes('advisory')
          ? undefined
          : sql.includes('catalog.id = ANY')
            ? [
                {
                  id: CLASS_ID,
                  type: 'kelas',
                  title: 'Belajar AutoCAD dari Nol',
                },
              ]
            : [],
      ),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(async (target, value) =>
        target === Discount ? { id: DISCOUNT_ID, ...value } : value,
      ),
      delete: jest.fn(),
      softDelete: jest.fn(),
      softRemove: jest.fn(),
    };
    service = new DiscountService({
      manager,
      query: dataSourceQuery,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource);
  });

  const input = (override: Partial<CreateDiscountDto> = {}) =>
    ({
      name: 'Diskon Kilat AutoCAD',
      discount_type: 'percentage',
      discount_value: 20,
      ...override,
    }) as CreateDiscountDto;

  it('generates one shared code per recurring entry and N single-use codes per once entry', async () => {
    await service.create(
      'user-id',
      input({
        targets: [{ type: 'kelas', id: CLASS_ID }],
        codes: [
          { code_type: 'once', usage_limit: 100 },
          { code_type: 'recurring', usage_limit: 500 },
        ],
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(DiscountProduct, [
      expect.objectContaining({ classId: CLASS_ID, productId: null }),
    ]);
    const savedCodes = manager.save.mock.calls
      .filter(([target]) => target === DiscountCode)
      .map(([, value]) => value);
    expect(savedCodes).toHaveLength(101);
    const singleUse = savedCodes.filter((code) => code.codeType === 'once');
    expect(singleUse).toHaveLength(100);
    expect(singleUse.every((code) => code.usageLimit === 1)).toBe(true);
    expect(savedCodes.filter((code) => code.codeType === 'recurring')).toEqual([
      expect.objectContaining({ usageLimit: 500 }),
    ]);
    expect(new Set(savedCodes.map((code) => code.code)).size).toBe(101);
  });

  it('limits single-use codes to 1,000 per request', async () => {
    await expect(
      service.create(
        'user-id',
        input({
          codes: [
            { code_type: 'once', usage_limit: 600 },
            { code_type: 'once', usage_limit: 401 },
          ],
        }),
      ),
    ).rejects.toThrow('At most 1000 single-use codes');
    expect(
      manager.save.mock.calls.filter(([target]) => target === DiscountCode),
    ).toHaveLength(0);
  });

  it('rejects a percentage above 100 and an inverted period', async () => {
    await expect(
      service.create('user-id', input({ discount_value: 120 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        'user-id',
        input({
          starts_at: '2026-10-02T00:00:00Z',
          ends_at: '2026-10-01T00:00:00Z',
        }),
      ),
    ).rejects.toThrow(/before ends_at/);
  });

  it('rejects foreign and duplicate targets', async () => {
    await expect(
      service.create(
        'user-id',
        input({ targets: [{ type: 'digital', id: PRODUCT_ID }] }),
      ),
    ).rejects.toThrow(/not one of your classes or digital products/);
    await expect(
      service.create(
        'user-id',
        input({
          targets: [
            { type: 'kelas', id: CLASS_ID },
            { type: 'kelas', id: CLASS_ID },
          ],
        }),
      ),
    ).rejects.toThrow(/distinct/);
  });

  it('takes targets by id alone and rejects another family by id', async () => {
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM (') && sql.includes('catalog.id = ANY')
        ? [{ id: CLASS_ID, type: 'kelas', title: 'AutoCAD' }]
        : [],
    );
    await expect(
      service.create(
        'user-id',
        input({ targets: [{ type: 'digital', id: CLASS_ID }] }),
      ),
    ).rejects.toThrow(`Item ${CLASS_ID} is a class, not digital`);
  });

  it('targets a bootcamp class and reports the target and status', async () => {
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('catalog.id = ANY')
        ? [{ id: CLASS_ID, type: 'bootcamp', title: 'Bootcamp BIM' }]
        : [],
    );
    dataSourceQuery.mockResolvedValueOnce([
      {
        discount_id: DISCOUNT_ID,
        id: CLASS_ID,
        type: 'bootcamp',
        title: 'Bootcamp BIM',
      },
    ]);
    manager.find.mockResolvedValueOnce([
      {
        id: codeId(1),
        discountId: DISCOUNT_ID,
        code: 'DSC-AAAAAAAA',
        codeType: 'once',
        usageLimit: 1,
        usedCount: 1,
      },
    ]);

    const { data } = await service.create(
      'user-id',
      input({ targets: [{ type: 'bootcamp', id: CLASS_ID }] }),
    );

    expect(manager.save).toHaveBeenCalledWith(DiscountProduct, [
      expect.objectContaining({ classId: CLASS_ID, productId: null }),
    ]);
    expect(data.targets).toEqual([
      { id: CLASS_ID, type: 'bootcamp', title: 'Bootcamp BIM' },
    ]);
    expect(data.status).toBe('limit_reached');
    const [targetSql] = dataSourceQuery.mock.calls[0];
    expect(targetSql).toContain(
      "THEN (CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END) ELSE 'digital' END AS type",
    );
  });

  it('hides other merchants discounts behind 404', async () => {
    manager.findOneBy.mockResolvedValue(null);
    await expect(service.remove('user-id', DISCOUNT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.findOneBy).toHaveBeenCalledWith(Discount, {
      id: DISCOUNT_ID,
      merchantId: 'merchant-id',
    });
  });

  describe('eligible items', () => {
    afterEach(() => {
      delete process.env.ASSET_PUBLIC_BASE_URL;
    });

    it('carries the price, image URL and availability from one query', async () => {
      process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.test';
      dataSourceQuery.mockResolvedValueOnce([
        {
          id: PRODUCT_ID,
          type: 'digital',
          title: 'Template RAB Excel',
          price: '125000.00',
          image: 'products/covers/rab.png',
          is_available: true,
        },
        {
          id: CLASS_ID,
          type: 'kelas',
          title: 'Belajar AutoCAD dari Nol',
          price: '0',
          image: null,
          is_available: false,
        },
      ]);

      const { data } = await service.findEligibleProducts('user-id');

      expect(data).toEqual([
        {
          id: PRODUCT_ID,
          type: 'digital',
          title: 'Template RAB Excel',
          price: 125000,
          image_url: 'https://cdn.test/products/covers/rab.png',
          is_available: true,
        },
        {
          id: CLASS_ID,
          type: 'kelas',
          title: 'Belajar AutoCAD dari Nol',
          price: 0,
          image_url: null,
          is_available: false,
        },
      ]);
      expect(dataSourceQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = dataSourceQuery.mock.calls[0];
      expect(sql).toContain('class."discountedPrice" > 0');
      expect(sql).toContain('product.discount_price > 0');
      expect(sql).toContain("class.status IN ('published', 'archived')");
      expect(sql).toContain('product.is_published');
      expect(sql).toContain(
        "(CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END) AS type",
      );
      expect(sql).toContain("ORDER BY catalog.type <> 'digital'");
      expect(params).toEqual(['merchant-id']);
    });

    it('reports a bootcamp class as bootcamp', async () => {
      dataSourceQuery.mockResolvedValueOnce([
        {
          id: CLASS_ID,
          type: 'bootcamp',
          title: 'Bootcamp BIM',
          price: '450000',
          image: null,
          is_available: true,
        },
      ]);

      const { data } = await service.findEligibleProducts('user-id');

      expect(data[0].type).toBe('bootcamp');
    });
  });

  describe('removeCodes', () => {
    const storedCode = (index: number, usageLimit = 1) =>
      ({
        id: codeId(index),
        discountId: DISCOUNT_ID,
        code: `DSC-CODE${String(index).padStart(4, '0')}`,
        codeType: usageLimit === 1 ? 'once' : 'recurring',
        usageLimit,
        usedCount: 0,
      }) as DiscountCode;

    const requestedIds = (where: { id?: FindOperator<string[]> }) =>
      where.id?.value ?? [];

    beforeEach(() => {
      manager.findOneBy.mockResolvedValue({
        id: DISCOUNT_ID,
        merchantId: 'merchant-id',
      });
    });

    it('removes 50 codes in one request and returns the remaining codes and quota', async () => {
      const removed = Array.from({ length: 50 }, (_, index) =>
        storedCode(index),
      );
      const remaining = [
        ...Array.from({ length: 10 }, (_, index) => storedCode(50 + index)),
        storedCode(60, 500),
      ];
      manager.find.mockImplementation(async (target, { where }) => {
        if (target !== DiscountCode) return [];
        // The transaction looks the requested codes up; the response
        // afterwards reads the codes left on the discount.
        return where.id
          ? removed.filter((code) => requestedIds(where).includes(code.id))
          : remaining;
      });
      const ids = removed.map((code) => code.id);

      const { data } = await service.removeCodes('user-id', DISCOUNT_ID, {
        code_ids: ids,
      });

      expect(manager.findOne).toHaveBeenCalledWith(Merchant, {
        where: { userId: 'user-id' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.findOneBy).toHaveBeenCalledWith(Discount, {
        id: DISCOUNT_ID,
        merchantId: 'merchant-id',
      });
      expect(manager.softDelete).toHaveBeenCalledTimes(1);
      const [target, criteria] = manager.softDelete.mock.calls[0];
      expect(target).toBe(DiscountCode);
      expect(criteria.discountId).toBe(DISCOUNT_ID);
      expect(requestedIds(criteria)).toEqual(ids);
      expect(data.codes.map((code) => code.id)).toEqual(
        remaining.map((code) => code.id),
      );
      expect(data.total_quota).toBe(510);
    });

    it('rejects codes of another discount or unknown ids, naming them, and changes nothing', async () => {
      const foreignId = codeId(900);
      const unknownId = codeId(901);
      manager.find.mockImplementation(async (target, { where }) =>
        target === DiscountCode
          ? [storedCode(1)].filter((code) =>
              requestedIds(where).includes(code.id),
            )
          : [],
      );

      const removal = service.removeCodes('user-id', DISCOUNT_ID, {
        code_ids: [codeId(1), foreignId, unknownId],
      });

      await expect(removal).rejects.toBeInstanceOf(BadRequestException);
      await expect(removal).rejects.toThrow(`${foreignId}, ${unknownId}`);
      expect(manager.find).toHaveBeenCalledWith(DiscountCode, {
        where: expect.objectContaining({ discountId: DISCOUNT_ID }),
      });
      expect(manager.softDelete).not.toHaveBeenCalled();
    });

    it('hides other merchants discounts behind 404', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.removeCodes('user-id', DISCOUNT_ID, { code_ids: [codeId(1)] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.softDelete).not.toHaveBeenCalled();
    });
  });
});
