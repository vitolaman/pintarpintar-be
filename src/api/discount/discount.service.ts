import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { isPromoCodeAvailable } from '~/common/promo-code/promo-code-namespace';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  AddDiscountCodesDto,
  CreateDiscountDto,
  DiscountCodeInputDto,
  DiscountListQueryDto,
  DiscountTargetInputDto,
  DiscountTargetType,
  RemoveDiscountCodesDto,
  UpdateDiscountDto,
} from './dto/discount-request.dto';
import {
  DiscountEligibleItemResponseDto,
  DiscountResponseDto,
} from './dto/discount-response.dto';
import { DiscountCode } from './entities/discount-code.entity';
import { DiscountProduct } from './entities/discount-product.entity';
import { Discount } from './entities/discount.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { assertItemFamily } from '~/common/catalog/catalog-item';
import { assetUrl } from '~/common/storage/asset-url';

// Uppercase letters and digits without look-alikes (0/O, 1/I/L).
// Bounds one request's work; a `once` entry generates one row per code.
const MAX_SINGLE_USE_CODES_PER_REQUEST = 1000;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PREFIX = 'DSC-';
const CODE_LENGTH = 8;
const MAX_CODE_ATTEMPTS = 5;

// The merchant's own classes and digital products that a discount can target.
const CATALOG_SQL = `
  SELECT class.id, 'kelas' AS type, class.title
  FROM classes class
  WHERE class.merchant_id = $1 AND class.deleted_at IS NULL
  UNION ALL
  SELECT product.id, 'digital', product.title
  FROM products product
  WHERE product.merchant_id = $1 AND product.deleted_at IS NULL
`;

// Same price and availability rules as the bundle eligible items: the current
// selling price is the discounted price when set, otherwise the list price.
const CLASS_PRICE_SQL = `(CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric`;
const PRODUCT_PRICE_SQL = `(CASE WHEN product.discount_price > 0 THEN product.discount_price ELSE COALESCE(product.original_price, 0) END)::numeric`;

const ELIGIBLE_ITEMS_SQL = `
  SELECT * FROM (
    SELECT class.id, 'kelas' AS type, class.title,
           ${CLASS_PRICE_SQL} AS price, class_cover.object_key AS image,
           class.status IN ('published', 'archived') AS is_available
    FROM classes class
    LEFT JOIN file_assets class_cover
      ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
    WHERE class.merchant_id = $1 AND class.deleted_at IS NULL
    UNION ALL
    SELECT product.id, 'digital', product.title,
           ${PRODUCT_PRICE_SQL}, cover.object_key, product.is_published
    FROM products product
    LEFT JOIN file_assets cover
      ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
    WHERE product.merchant_id = $1 AND product.deleted_at IS NULL
  ) catalog
  ORDER BY catalog.type, catalog.title, catalog.id
`;

interface CatalogRow {
  id: string;
  type: DiscountTargetType;
  title: string;
}

interface EligibleItemRow extends CatalogRow {
  price: string;
  image: string | null;
  is_available: boolean;
}

@Injectable()
export class DiscountService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findEligibleProducts(userId: string) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    const rows: EligibleItemRow[] = await this.dataSource.query(
      ELIGIBLE_ITEMS_SQL,
      [merchant.id],
    );
    const data: DiscountEligibleItemResponseDto[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      price: Number(row.price),
      image_url: assetUrl(row.image),
      is_available: row.is_available,
    }));
    return { data, responseMessage: 'Get eligible products success' };
  }

  async create(userId: string, input: CreateDiscountDto) {
    const discountId = await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      assertValueAndPeriod(
        input.discount_type,
        input.discount_value,
        input.starts_at,
        input.ends_at,
      );
      const targets = await this.resolveTargets(
        manager,
        merchant.id,
        input.targets ?? [],
      );

      const discount = await manager.save(
        Discount,
        manager.create(Discount, {
          merchantId: merchant.id,
          name: input.name,
          discountType: input.discount_type,
          discountValue: String(input.discount_value),
          minimumPurchase:
            input.minimum_purchase == null
              ? null
              : String(input.minimum_purchase),
          startsAt: input.starts_at ? new Date(input.starts_at) : null,
          endsAt: input.ends_at ? new Date(input.ends_at) : null,
          isActive: input.is_active ?? true,
        }),
      );
      await this.insertTargets(manager, discount.id, targets);
      await this.generateCodes(manager, discount.id, input.codes ?? []);
      return discount.id;
    });

    return {
      data: await this.findResponse(discountId),
      responseMessage: 'Create discount success',
    };
  }

  async findAll(userId: string, query: DiscountListQueryDto) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    const { page, limit } = query;
    const [discounts, total] = await this.dataSource.manager.findAndCount(
      Discount,
      {
        where: { merchantId: merchant.id },
        order: { created_at: 'DESC', id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: await this.toResponses(discounts),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get discounts success',
    };
  }

  async findOne(userId: string, id: string) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    await this.findOwnedDiscount(this.dataSource.manager, merchant.id, id);
    return {
      data: await this.findResponse(id),
      responseMessage: 'Get discount success',
    };
  }

  async update(userId: string, id: string, input: UpdateDiscountDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const discount = await this.findOwnedDiscount(manager, merchant.id, id);

      if (input.name !== undefined) discount.name = input.name;
      if (input.discount_type !== undefined)
        discount.discountType = input.discount_type;
      if (input.discount_value !== undefined)
        discount.discountValue = String(input.discount_value);
      if (input.minimum_purchase !== undefined) {
        discount.minimumPurchase =
          input.minimum_purchase == null
            ? null
            : String(input.minimum_purchase);
      }
      if (input.starts_at !== undefined)
        discount.startsAt = input.starts_at ? new Date(input.starts_at) : null;
      if (input.ends_at !== undefined)
        discount.endsAt = input.ends_at ? new Date(input.ends_at) : null;
      if (input.is_active !== undefined) discount.isActive = input.is_active;

      assertValueAndPeriod(
        discount.discountType,
        Number(discount.discountValue),
        discount.startsAt?.toISOString(),
        discount.endsAt?.toISOString(),
      );
      await manager.save(Discount, discount);

      if (input.targets !== undefined) {
        const targets = await this.resolveTargets(
          manager,
          merchant.id,
          input.targets,
        );
        await manager.delete(DiscountProduct, { discountId: discount.id });
        await this.insertTargets(manager, discount.id, targets);
      }
    });

    return {
      data: await this.findResponse(id),
      responseMessage: 'Update discount success',
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const discount = await this.findOwnedDiscount(manager, merchant.id, id);
      await manager.softDelete(DiscountCode, { discountId: discount.id });
      await manager.softRemove(Discount, discount);
    });
  }

  async addCodes(userId: string, id: string, input: AddDiscountCodesDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const discount = await this.findOwnedDiscount(manager, merchant.id, id);
      await this.generateCodes(manager, discount.id, input.codes);
    });

    return {
      data: await this.findResponse(id),
      responseMessage: 'Add discount codes success',
    };
  }

  async removeCodes(userId: string, id: string, input: RemoveDiscountCodesDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const discount = await this.findOwnedDiscount(manager, merchant.id, id);
      const codes = await manager.find(DiscountCode, {
        where: { id: In(input.code_ids), discountId: discount.id },
      });

      const foundIds = new Set(codes.map((code) => code.id));
      const unknownIds = input.code_ids.filter(
        (codeId) => !foundIds.has(codeId),
      );
      if (unknownIds.length > 0) {
        throw new BadRequestException(
          `Codes ${unknownIds.join(', ')} are not codes of this discount`,
        );
      }

      // Follows removeCode: a code is soft-deleted whether or not it was used.
      await manager.softDelete(DiscountCode, {
        id: In(input.code_ids),
        discountId: discount.id,
      });
    });

    return {
      data: await this.findResponse(id),
      responseMessage: 'Remove discount codes success',
    };
  }

  async removeCode(userId: string, codeId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const code = await manager.findOneBy(DiscountCode, { id: codeId });
      const owner = code
        ? await manager.findOneBy(Discount, {
            id: code.discountId,
            merchantId: merchant.id,
          })
        : null;
      if (!code || !owner)
        throw new NotFoundException('Discount code not found');
      await manager.softRemove(DiscountCode, code);
    });
  }

  // Locking the merchant row serializes every discount write of one merchant.
  private async findMerchant(
    manager: EntityManager,
    userId: string,
    lock = false,
  ): Promise<Merchant> {
    const merchant = await manager.findOne(Merchant, {
      where: { userId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  private async findOwnedDiscount(
    manager: EntityManager,
    merchantId: string,
    id: string,
  ): Promise<Discount> {
    const discount = await manager.findOneBy(Discount, { id, merchantId });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  private async resolveTargets(
    manager: EntityManager,
    merchantId: string,
    inputs: DiscountTargetInputDto[],
  ): Promise<CatalogRow[]> {
    const ids = inputs.map((input) => input.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Discount targets must be distinct');
    }
    if (inputs.length === 0) return [];

    const rows: CatalogRow[] = await manager.query(
      `SELECT * FROM (${CATALOG_SQL}) catalog WHERE catalog.id = ANY($2::uuid[])`,
      [merchantId, ids],
    );
    const byId = new Map(rows.map((row) => [row.id, row]));

    return inputs.map((input) => {
      const row = byId.get(input.id);
      if (!row) {
        throw new BadRequestException(
          `Target ${input.id} is not one of your classes or digital products`,
        );
      }
      assertItemFamily(
        input.id,
        input.type,
        row.type === 'kelas' ? 'class' : 'product',
      );
      return row;
    });
  }

  private async insertTargets(
    manager: EntityManager,
    discountId: string,
    targets: CatalogRow[],
  ): Promise<void> {
    if (targets.length === 0) return;
    await manager.save(
      DiscountProduct,
      targets.map((target) =>
        manager.create(DiscountProduct, {
          discountId,
          classId: target.type === 'kelas' ? target.id : null,
          productId: target.type === 'digital' ? target.id : null,
        }),
      ),
    );
  }

  private async generateCodes(
    manager: EntityManager,
    discountId: string,
    entries: DiscountCodeInputDto[],
  ): Promise<void> {
    const singleUseCodes = entries
      .filter((entry) => entry.code_type === 'once')
      .reduce((total, entry) => total + entry.usage_limit, 0);
    if (singleUseCodes > MAX_SINGLE_USE_CODES_PER_REQUEST) {
      throw new BadRequestException(
        `At most ${MAX_SINGLE_USE_CODES_PER_REQUEST} single-use codes can be generated per request`,
      );
    }

    for (const entry of entries) {
      const singleUse = entry.code_type === 'once';
      const copies = singleUse ? entry.usage_limit : 1;
      for (let index = 0; index < copies; index++) {
        const code = await this.nextAvailableCode(manager);
        await manager.save(
          DiscountCode,
          manager.create(DiscountCode, {
            discountId,
            code,
            codeType: entry.code_type,
            usageLimit: singleUse ? 1 : entry.usage_limit,
            usedCount: 0,
          }),
        );
      }
    }
  }

  private async nextAvailableCode(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateDiscountCode();
      if (await isPromoCodeAvailable(manager, code)) return code;
    }
    throw new InternalServerErrorException(
      'Could not generate a unique discount code',
    );
  }

  private async findResponse(id: string): Promise<DiscountResponseDto> {
    const discount = await this.dataSource.manager.findOneByOrFail(Discount, {
      id,
    });
    const [response] = await this.toResponses([discount]);
    return response;
  }

  private async toResponses(
    discounts: Discount[],
  ): Promise<DiscountResponseDto[]> {
    if (discounts.length === 0) return [];
    const ids = discounts.map((discount) => discount.id);

    const [targetRows, codes] = await Promise.all([
      this.dataSource.query(
        `SELECT target.discount_id,
                COALESCE(class.id, product.id) AS id,
                CASE WHEN target.class_id IS NOT NULL THEN 'kelas' ELSE 'digital' END AS type,
                COALESCE(class.title, product.title) AS title
         FROM discount_products target
         LEFT JOIN classes class ON class.id = target.class_id
         LEFT JOIN products product ON product.id = target.product_id
         WHERE target.discount_id = ANY($1::uuid[])
         ORDER BY target.discount_id, target.created_at, target.id`,
        [ids],
      ) as Promise<(CatalogRow & { discount_id: string })[]>,
      this.dataSource.manager.find(DiscountCode, {
        where: { discountId: In(ids) },
        order: { created_at: 'ASC', id: 'ASC' },
      }),
    ]);

    const now = new Date();
    return discounts.map((discount) => {
      const targets = targetRows.filter(
        (row) => row.discount_id === discount.id,
      );
      const discountCodes = codes.filter(
        (code) => code.discountId === discount.id,
      );

      return {
        id: discount.id,
        name: discount.name,
        discount_type: discount.discountType,
        discount_value: Number(discount.discountValue),
        minimum_purchase:
          discount.minimumPurchase == null
            ? null
            : Number(discount.minimumPurchase),
        starts_at: discount.startsAt,
        ends_at: discount.endsAt,
        is_active: discount.isActive,
        status: deriveStatus(discount, now),
        applies_to_all: targets.length === 0,
        targets: targets.map(({ id, type, title }) => ({ id, type, title })),
        codes: discountCodes.map((code) => ({
          id: code.id,
          code: code.code,
          code_type: code.codeType,
          usage_limit: code.usageLimit,
          used_count: code.usedCount,
        })),
        total_quota: discountCodes.reduce(
          (total, code) => total + code.usageLimit,
          0,
        ),
        created_at: discount.created_at,
      };
    });
  }
}

export function generateDiscountCode(): string {
  let suffix = '';
  for (let index = 0; index < CODE_LENGTH; index++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + suffix;
}

export function deriveStatus(
  discount: Pick<Discount, 'isActive' | 'startsAt' | 'endsAt'>,
  now: Date,
): 'inactive' | 'scheduled' | 'expired' | 'active' {
  if (!discount.isActive) return 'inactive';
  if (discount.startsAt && now < discount.startsAt) return 'scheduled';
  if (discount.endsAt && now >= discount.endsAt) return 'expired';
  return 'active';
}

function assertValueAndPeriod(
  type: string,
  value: number,
  startsAt?: string | null,
  endsAt?: string | null,
): void {
  if (type === 'percentage' && value > 100) {
    throw new BadRequestException('A percentage discount cannot exceed 100');
  }
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    throw new BadRequestException('starts_at must be before ends_at');
  }
}
