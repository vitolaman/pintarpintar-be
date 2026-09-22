import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  merchantCategoryLabelForSlug,
  merchantCategorySlugForLabel,
} from '~/common/constants/merchant-category';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { PublicVoucherQueryDto } from './dto/voucher-query.dto';
import {
  PublicVoucherResponseDto,
  VoucherResponseDto,
} from './dto/voucher-response.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { Voucher } from './entities/voucher.entity';

@Injectable()
export class VoucherService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, input: CreateVoucherDto) {
    let voucherId = '';
    const code = this.normalizeCode(input.code);
    this.validateDiscount(input.discount_type, input.discount_value);
    this.validatePeriod(input.starts_at, input.expires_at);
    this.rejectProductIds(input);
    try {
      await this.dataSource.transaction(async (manager) => {
        const merchant = await this.findOwnedMerchant(manager, userId, true);
        await this.ensureCodeAvailable(manager, code);

        const voucher = await manager.save(
          Voucher,
          manager.create(Voucher, {
            merchantId: merchant.id,
            name: input.name,
            code,
            description: input.description ?? null,
            terms: input.terms ?? null,
            discountType: input.discount_type,
            discountValue: String(input.discount_value),
            minimumOrderAmount: this.money(input.minimum_order_amount),
            maximumDiscountAmount: this.money(input.maximum_discount_amount),
            maxUses: input.max_uses ?? null,
            startsAt: this.date(input.starts_at),
            expiresAt: this.date(input.expires_at),
            isActive: input.is_active ?? true,
          }),
        );
        voucherId = voucher.id;
      });
    } catch (error) {
      this.rethrowUniqueCode(error);
    }

    return this.findOne(userId, voucherId, 'Create voucher success');
  }

  async findAll(userId: string, page = 1, limit = 10) {
    await this.findOwnedMerchant(this.dataSource.manager, userId);
    const offset = (page - 1) * limit;
    const [rows, countRows] = await Promise.all([
      this.merchantVoucherRows(userId, limit, offset),
      this.dataSource.query(
        `
          SELECT COUNT(*)::integer AS total
          FROM coupons coupon
          INNER JOIN merchants merchant ON merchant.id = coupon.merchant_id
          WHERE merchant.user_id = $1
            AND merchant.deleted_at IS NULL
            AND coupon.deleted_at IS NULL
        `,
        [userId],
      ) as Promise<Array<{ total: number }>>,
    ]);
    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((row) => this.toVoucherResponse(row)),
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
      responseMessage: 'Get vouchers success',
    };
  }

  async findOne(userId: string, id: string, message = 'Get voucher success') {
    await this.findOwnedMerchant(this.dataSource.manager, userId);
    const [row] = await this.merchantVoucherRows(
      userId,
      undefined,
      undefined,
      id,
    );
    if (!row) throw new NotFoundException('Voucher not found');

    return {
      data: this.toVoucherResponse(row),
      responseMessage: message,
    };
  }

  async update(userId: string, id: string, input: UpdateVoucherDto) {
    this.rejectProductIds(input);
    try {
      await this.dataSource.transaction(async (manager) => {
        const merchant = await this.findOwnedMerchant(manager, userId, true);
        const voucher = await manager.findOne(Voucher, {
          where: { id, merchantId: merchant.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!voucher) throw new NotFoundException('Voucher not found');

        const discountType = input.discount_type ?? voucher.discountType;
        const discountValue =
          input.discount_value ?? Number(voucher.discountValue);
        const startsAt =
          input.starts_at === undefined
            ? voucher.startsAt
            : this.date(input.starts_at);
        const expiresAt =
          input.expires_at === undefined
            ? voucher.expiresAt
            : this.date(input.expires_at);
        this.validateDiscount(discountType, discountValue);
        this.validatePeriod(startsAt, expiresAt);

        if (input.code !== undefined) {
          voucher.code = this.normalizeCode(input.code);
          await this.ensureCodeAvailable(manager, voucher.code, voucher.id);
        }
        if (input.name !== undefined) voucher.name = input.name;
        if (input.description !== undefined)
          voucher.description = input.description;
        if (input.terms !== undefined) voucher.terms = input.terms;
        if (input.discount_type !== undefined)
          voucher.discountType = input.discount_type;
        if (input.discount_value !== undefined) {
          voucher.discountValue = String(input.discount_value);
        }
        if (input.minimum_order_amount !== undefined) {
          voucher.minimumOrderAmount = this.money(input.minimum_order_amount);
        }
        if (input.maximum_discount_amount !== undefined) {
          voucher.maximumDiscountAmount = this.money(
            input.maximum_discount_amount,
          );
        }
        if (input.max_uses !== undefined) voucher.maxUses = input.max_uses;
        if (input.starts_at !== undefined) voucher.startsAt = startsAt;
        if (input.expires_at !== undefined) voucher.expiresAt = expiresAt;
        if (input.is_active !== undefined) voucher.isActive = input.is_active;

        await manager.save(Voucher, voucher);
      });
    } catch (error) {
      this.rethrowUniqueCode(error);
    }

    return this.findOne(userId, id, 'Update voucher success');
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findOwnedMerchant(manager, userId, true);
      const voucher = await manager.findOne(Voucher, {
        where: { id, merchantId: merchant.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!voucher) throw new NotFoundException('Voucher not found');
      await manager.softRemove(voucher);
    });
  }

  async findPublic(query: PublicVoucherQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const now = new Date();
    const search = query.search?.trim() ?? '';
    const merchantSlug = query.merchant_slug ?? null;
    const categoryLabel = query.category_slug
      ? merchantCategoryLabelForSlug(query.category_slug)
      : null;
    if (query.category_slug && categoryLabel === null) {
      return this.emptyPublicPage(page, limit);
    }

    const [rows, countRows] = await Promise.all([
      this.publicVoucherRows(
        now,
        search,
        categoryLabel,
        merchantSlug,
        limit,
        offset,
      ),
      this.publicVoucherCount(now, search, categoryLabel, merchantSlug),
    ]);
    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((row) => this.toPublicVoucherResponse(row)),
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
      responseMessage: 'Get public vouchers success',
    };
  }

  async findFeatured() {
    const rows = await this.publicVoucherRows(new Date(), '', null, null, 3, 0);
    return {
      data: rows.map((row) => this.toPublicVoucherResponse(row)),
      responseMessage: 'Get featured vouchers success',
    };
  }

  private emptyPublicPage(page: number, limit: number) {
    return {
      data: [] as PublicVoucherResponseDto[],
      meta: { page, limit, total: 0, totalPage: 0 },
      responseMessage: 'Get public vouchers success',
    };
  }

  private async findOwnedMerchant(
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

  private async ensureCodeAvailable(
    manager: EntityManager,
    code: string,
    excludedId?: string,
  ): Promise<void> {
    const rows = (await manager.query(
      `
        SELECT id
        FROM coupons
        WHERE UPPER(code) = UPPER($1)
          AND deleted_at IS NULL
          AND ($2::uuid IS NULL OR id <> $2)
        LIMIT 1
      `,
      [code, excludedId ?? null],
    )) as Array<{ id: string }>;
    if (rows.length) throw new ConflictException('Voucher code already exists');
  }

  private rejectProductIds(input: CreateVoucherDto | UpdateVoucherDto): void {
    if ((input as { product_ids?: unknown }).product_ids !== undefined) {
      throw new BadRequestException(
        'Vouchers apply to the whole store; product_ids is not accepted',
      );
    }
  }

  private merchantVoucherRows(
    userId: string,
    limit?: number,
    offset?: number,
    voucherId?: string,
  ): Promise<VoucherRow[]> {
    const pagination =
      limit === undefined
        ? ''
        : `LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
    return this.dataSource.query(
      `
        SELECT
          coupon.id, coupon.merchant_id, coupon.name, coupon.code,
          coupon.description, coupon.terms, coupon.discount_type,
          coupon.discount_value, coupon.minimum_order_amount,
          coupon.maximum_discount_amount, coupon.max_uses, coupon.starts_at,
          coupon.expires_at, coupon.is_active, coupon.created_at,
          COUNT(usage.id)::integer AS usage_count
        FROM coupons coupon
        INNER JOIN merchants merchant
          ON merchant.id = coupon.merchant_id AND merchant.deleted_at IS NULL
        LEFT JOIN coupon_usages usage
          ON usage.coupon_id = coupon.id AND usage.deleted_at IS NULL
        WHERE merchant.user_id = $1
          AND coupon.deleted_at IS NULL
          AND ($2::uuid IS NULL OR coupon.id = $2)
        GROUP BY coupon.id
        ORDER BY coupon.created_at DESC
        ${pagination}
      `,
      [userId, voucherId ?? null],
    ) as Promise<VoucherRow[]>;
  }

  private publicVoucherRows(
    now: Date,
    search: string,
    categoryLabel: string | null,
    merchantSlug: string | null,
    limit: number,
    offset: number,
  ): Promise<PublicVoucherRow[]> {
    return this.dataSource.query(
      `
        WITH visible AS (
          SELECT coupon.id
          FROM coupons coupon
          INNER JOIN merchants merchant
            ON merchant.id = coupon.merchant_id
            AND merchant.deleted_at IS NULL
            AND merchant.status = 'active'
          LEFT JOIN coupon_usages usage
            ON usage.coupon_id = coupon.id AND usage.deleted_at IS NULL
          WHERE coupon.deleted_at IS NULL
            AND coupon.is_active = true
            AND (coupon.starts_at IS NULL OR coupon.starts_at <= $1)
            AND (coupon.expires_at IS NULL OR coupon.expires_at > $1)
            AND ($2 = '' OR coupon.name ILIKE '%' || $2 || '%'
              OR coupon.code ILIKE '%' || $2 || '%'
              OR coupon.description ILIKE '%' || $2 || '%'
              OR merchant.store_name ILIKE '%' || $2 || '%')
          GROUP BY coupon.id
          HAVING coupon.max_uses IS NULL OR COUNT(usage.id) < coupon.max_uses
        )
        SELECT
          coupon.id, coupon.name, coupon.code, coupon.description,
          coupon.discount_type, coupon.discount_value,
          coupon.minimum_order_amount, coupon.expires_at,
          merchant.id AS merchant_id, merchant.store_name AS merchant_name,
          profile.slug AS merchant_slug,
          profile.avatar_asset_id AS merchant_avatar_asset_id,
          profile.tagline AS merchant_tagline,
          profile.category_label AS merchant_category_label
        FROM visible
        INNER JOIN coupons coupon ON coupon.id = visible.id
        INNER JOIN merchants merchant ON merchant.id = coupon.merchant_id
        LEFT JOIN merchant_profiles profile
          ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
        WHERE ($3::varchar IS NULL OR profile.category_label = $3)
          AND ($4::varchar IS NULL OR profile.slug = $4)
        ORDER BY coupon.created_at DESC
        LIMIT $5 OFFSET $6
      `,
      [now, search, categoryLabel, merchantSlug, limit, offset],
    ) as Promise<PublicVoucherRow[]>;
  }

  private publicVoucherCount(
    now: Date,
    search: string,
    categoryLabel: string | null,
    merchantSlug: string | null,
  ): Promise<Array<{ total: number }>> {
    return this.dataSource.query(
      `
        WITH visible AS (
          SELECT coupon.id
          FROM coupons coupon
          INNER JOIN merchants merchant
            ON merchant.id = coupon.merchant_id
            AND merchant.deleted_at IS NULL
            AND merchant.status = 'active'
          LEFT JOIN coupon_usages usage
            ON usage.coupon_id = coupon.id AND usage.deleted_at IS NULL
          WHERE coupon.deleted_at IS NULL
            AND coupon.is_active = true
            AND (coupon.starts_at IS NULL OR coupon.starts_at <= $1)
            AND (coupon.expires_at IS NULL OR coupon.expires_at > $1)
            AND ($2 = '' OR coupon.name ILIKE '%' || $2 || '%'
              OR coupon.code ILIKE '%' || $2 || '%'
              OR coupon.description ILIKE '%' || $2 || '%'
              OR merchant.store_name ILIKE '%' || $2 || '%')
          GROUP BY coupon.id
          HAVING coupon.max_uses IS NULL OR COUNT(usage.id) < coupon.max_uses
        )
        SELECT COUNT(*)::integer AS total
        FROM visible
        INNER JOIN coupons coupon ON coupon.id = visible.id
        INNER JOIN merchants merchant ON merchant.id = coupon.merchant_id
        LEFT JOIN merchant_profiles profile
          ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
        WHERE ($3::varchar IS NULL OR profile.category_label = $3)
          AND ($4::varchar IS NULL OR profile.slug = $4)
      `,
      [now, search, categoryLabel, merchantSlug],
    ) as Promise<Array<{ total: number }>>;
  }

  private toVoucherResponse(row: VoucherRow): VoucherResponseDto {
    const now = new Date();
    const status = !row.is_active
      ? 'inactive'
      : row.starts_at && new Date(row.starts_at) > now
        ? 'scheduled'
        : row.expires_at && new Date(row.expires_at) <= now
          ? 'expired'
          : row.max_uses !== null &&
              Number(row.usage_count) >= Number(row.max_uses)
            ? 'quota_reached'
            : 'active';
    return {
      ...row,
      discount_value: Number(row.discount_value),
      minimum_order_amount: this.numberOrNull(row.minimum_order_amount),
      maximum_discount_amount: this.numberOrNull(row.maximum_discount_amount),
      max_uses: this.numberOrNull(row.max_uses),
      usage_count: Number(row.usage_count),
      status,
    };
  }

  private toPublicVoucherResponse(
    row: PublicVoucherRow,
  ): PublicVoucherResponseDto {
    return {
      ...row,
      discount_value: Number(row.discount_value),
      minimum_order_amount: this.numberOrNull(row.minimum_order_amount),
      merchant_category_slug: merchantCategorySlugForLabel(
        row.merchant_category_label,
      ),
    };
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private validateDiscount(type: string, value: number): void {
    if (type === 'percentage' && value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
  }

  private validatePeriod(
    startsAt: string | Date | null | undefined,
    expiresAt: string | Date | null | undefined,
  ): void {
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      throw new BadRequestException('Voucher start must be before expiry');
    }
  }

  private money(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : String(value);
  }

  private numberOrNull(value: string | number | null): number | null {
    return value === null ? null : Number(value);
  }

  private date(value: string | null | undefined): Date | null {
    return value ? new Date(value) : null;
  }

  private rethrowUniqueCode(error: unknown): void {
    if ((error as { code?: string }).code === '23505') {
      throw new ConflictException('Voucher code already exists');
    }
    throw error;
  }
}

interface VoucherRow {
  id: string;
  merchant_id: string;
  name: string;
  code: string;
  description: string | null;
  terms: string | null;
  discount_type: string;
  discount_value: string;
  minimum_order_amount: string | null;
  maximum_discount_amount: string | null;
  max_uses: number | null;
  starts_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  usage_count: number;
}

interface PublicVoucherRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: string;
  minimum_order_amount: string | null;
  expires_at: Date | null;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string | null;
  merchant_avatar_asset_id: string | null;
  merchant_tagline: string | null;
  merchant_category_label: string | null;
}
