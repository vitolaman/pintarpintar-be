import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
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
} from './dto/discount-request.dto';
import { DiscountCode } from './entities/discount-code.entity';
import { DiscountProduct } from './entities/discount-product.entity';
import { Discount } from './entities/discount.entity';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002';
const DISCOUNT_ID = '10000000-0000-4000-8000-000000000003';

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
    expect(deriveStatus(discount, now)).toBe(status);
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

  it('rejects a client-supplied code string', async () => {
    const dto = plainToInstance(AddDiscountCodesDto, {
      codes: [{ code_type: 'once', usage_limit: 10, code: 'MYCODE' }],
    });
    expect(await validate(dto)).not.toHaveLength(0);
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
  let service: DiscountService;

  beforeEach(() => {
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
      query: jest.fn(async () => []),
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

  it('stores targets and one generated code per entry', async () => {
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
    expect(savedCodes).toHaveLength(2);
    expect(savedCodes.map((code) => code.codeType)).toEqual([
      'once',
      'recurring',
    ]);
    expect(savedCodes[0].code).not.toBe(savedCodes[1].code);
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
});
