import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
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
import { CouponClaim } from './entities/coupon-claim.entity';
import { Voucher } from './entities/voucher.entity';
import { isPromoCodeAvailable } from '~/common/promo-code/promo-code-namespace';
import { escapeLike } from '~/common/util/escape-like';
import { paginationMeta } from '~/common/dto/response-meta.dto';

export const FEATURED_VOUCHER_COUNT = 3;

// Presentation labels from the voucher pages, assigned per voucher so a
// voucher keeps the same tag across requests.
export const VOUCHER_TAGS = [
  'PROMO SUPER',
  'DISKON TINGGI',
  'PENGGUNA BARU',
  'BUNDLING PROMO',
  'PRODUK DIGITAL',
  'PROMO KREATIF',
];

type MerchantScope = { slug: string | null; id: string | null };

interface PublicVoucherFilter {
  search?: string;
  categoryLabel?: string | null;
  merchant?: MerchantScope;
  merchantIds?: string[];
  voucherId?: string;
  viewerId?: string;
  claims?: 'any' | 'claimed' | 'unclaimed';
}

const PUBLIC_VOUCHER_ORDER = {
  newest: 'coupon.created_at DESC, coupon.id DESC',
  random: 'random()',
  claimed:
    'claim.created_at DESC NULLS LAST, coupon.created_at DESC, coupon.id DESC',
};
type PublicVoucherOrder = keyof typeof PUBLIC_VOUCHER_ORDER;

@Injectable()
export class VoucherService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, input: CreateVoucherDto) {
    let voucherId = '';
    const code = this.normalizeCode(input.code);
    this.validateDiscount(input.discount_type, input.discount_value);
    this.validatePeriod(input.starts_at, input.ends_at);
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
            minimumOrderAmount: this.money(input.minimum_purchase),
            maximumDiscountAmount: this.money(input.maximum_discount_amount),
            maxUses: input.usage_limit ?? null,
            startsAt: this.date(input.starts_at),
            expiresAt: this.date(input.ends_at),
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
      meta: paginationMeta(page, limit, total),
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
          input.ends_at === undefined
            ? voucher.expiresAt
            : this.date(input.ends_at);
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
        if (input.minimum_purchase !== undefined) {
          voucher.minimumOrderAmount = this.money(input.minimum_purchase);
        }
        if (input.maximum_discount_amount !== undefined) {
          voucher.maximumDiscountAmount = this.money(
            input.maximum_discount_amount,
          );
        }
        if (input.usage_limit !== undefined) {
          voucher.maxUses = input.usage_limit;
        }
        if (input.starts_at !== undefined) voucher.startsAt = startsAt;
        if (input.ends_at !== undefined) voucher.expiresAt = expiresAt;
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

  async findPublic(query: PublicVoucherQueryDto, viewerId?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const categoryLabel = query.category_slug
      ? merchantCategoryLabelForSlug(query.category_slug)
      : null;
    if (query.category_slug && categoryLabel === null) {
      return this.emptyPublicPage(page, limit);
    }
    const filter: PublicVoucherFilter = {
      search: query.search,
      categoryLabel,
      merchant: {
        slug: query.merchant_slug ?? null,
        id: query.merchant_id ?? null,
      },
      viewerId,
    };
    return {
      ...(await this.publicVoucherPage(filter, page, limit, 'newest')),
      responseMessage: 'Get public vouchers success',
    };
  }

  async findFeatured(viewerId?: string) {
    const rows = await this.publicVoucherRows(
      { viewerId },
      'random',
      FEATURED_VOUCHER_COUNT,
    );
    return {
      data: rows.map((row) => this.toPublicVoucherResponse(row)),
      responseMessage: 'Get featured vouchers success',
    };
  }

  async findRandomPublic(limit: number, viewerId?: string) {
    const rows = await this.publicVoucherRows({ viewerId }, 'random', limit);
    return rows.map((row) => this.toPublicVoucherResponse(row));
  }

  // Only vouchers still usable; one that expires or runs out leaves the list
  // while its claim stays.
  async findClaimed(userId: string, page = 1, limit = 10) {
    const filter: PublicVoucherFilter = { viewerId: userId, claims: 'claimed' };
    return {
      ...(await this.publicVoucherPage(filter, page, limit, 'claimed')),
      responseMessage: 'Get claimed vouchers success',
    };
  }

  // Claiming saves a usable voucher for checkout; it reserves no use.
  async claim(userId: string, voucherId: string) {
    const [row] = await this.publicVoucherRows(
      { voucherId, viewerId: userId },
      'newest',
      1,
    );
    if (!row) throw new NotFoundException('Voucher not found');
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(CouponClaim)
      .values({ userId, couponId: voucherId })
      .orIgnore()
      .execute();
    return {
      data: { ...this.toPublicVoucherResponse(row), is_claimed: true },
      responseMessage: 'Claim voucher success',
    };
  }

  async unclaim(userId: string, voucherId: string): Promise<void> {
    await this.dataSource.manager.softDelete(CouponClaim, {
      userId,
      couponId: voucherId,
      deleted_at: IsNull(),
    });
  }

  // The usable vouchers of the given merchants, split by the buyer's claims.
  async checkoutVouchers(userId: string, merchantIds: string[]) {
    if (merchantIds.length === 0) return { claimed: [], recommended: [] };
    const rows = await this.publicVoucherRows(
      { merchantIds, viewerId: userId },
      'claimed',
      null,
    );
    const vouchers = rows.map((row) => this.toPublicVoucherResponse(row));
    return {
      claimed: vouchers.filter((voucher) => voucher.is_claimed),
      recommended: vouchers.filter((voucher) => !voucher.is_claimed),
    };
  }

  private emptyPublicPage(page: number, limit: number) {
    return {
      data: [] as PublicVoucherResponseDto[],
      meta: paginationMeta(page, limit, 0),
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
    const available = await isPromoCodeAvailable(manager, code, {
      voucherId: excludedId,
    });
    if (!available) throw new ConflictException('Voucher code already exists');
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
          coupon.discount_value,
          coupon.minimum_order_amount AS minimum_purchase,
          coupon.maximum_discount_amount,
          coupon.max_uses AS usage_limit,
          coupon.starts_at,
          coupon.expires_at AS ends_at,
          coupon.is_active, coupon.created_at,
          COUNT(usage.id)::integer AS used_count
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

  private async publicVoucherPage(
    filter: PublicVoucherFilter,
    page: number,
    limit: number,
    order: PublicVoucherOrder,
  ) {
    const [rows, total] = await Promise.all([
      this.publicVoucherRows(filter, order, limit, (page - 1) * limit),
      this.publicVoucherCount(filter),
    ]);
    return {
      data: rows.map((row) => this.toPublicVoucherResponse(row)),
      meta: paginationMeta(page, limit, total),
    };
  }

  // A null limit returns every match.
  private publicVoucherRows(
    filter: PublicVoucherFilter,
    order: PublicVoucherOrder,
    limit: number | null,
    offset = 0,
  ): Promise<PublicVoucherRow[]> {
    const { sql, params } = this.publicVoucherSource(filter);
    return this.dataSource.query(
      `
        ${sql.with}
        SELECT
          coupon.id, coupon.name, coupon.code, coupon.description,
          coupon.discount_type, coupon.discount_value,
          coupon.minimum_order_amount AS minimum_purchase,
          coupon.maximum_discount_amount,
          coupon.expires_at AS ends_at,
          merchant.id AS merchant_id, merchant.store_name AS merchant_name,
          profile.slug AS merchant_slug,
          avatar.object_key AS merchant_avatar_object_key,
          profile.tagline AS merchant_tagline,
          profile.category_label AS merchant_category_label,
          (ARRAY[${VOUCHER_TAGS.map((tag) => `'${tag}'`).join(', ')}])[
            1 + mod(abs(hashtext(coupon.id::text)), ${VOUCHER_TAGS.length})
          ] AS tag,
          claim.id IS NOT NULL AS is_claimed
        ${sql.from}
        ORDER BY ${PUBLIC_VOUCHER_ORDER[order]}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    ) as Promise<PublicVoucherRow[]>;
  }

  private async publicVoucherCount(
    filter: PublicVoucherFilter,
  ): Promise<number> {
    const { sql, params } = this.publicVoucherSource(filter);
    const rows = (await this.dataSource.query(
      `${sql.with} SELECT COUNT(*)::integer AS total ${sql.from}`,
      params,
    )) as Array<{ total: number }>;
    return Number(rows[0]?.total ?? 0);
  }

  // Usable vouchers: active and in period, of an active store, with uses
  // left. `claim` is the viewer's live claim, absent without a viewer.
  private publicVoucherSource(filter: PublicVoucherFilter) {
    const params = [
      new Date(),
      // Wildcards in the search text match literally.
      escapeLike(filter.search?.trim() ?? ''),
      filter.categoryLabel ?? null,
      filter.merchant?.slug ?? null,
      filter.merchant?.id ?? null,
      filter.merchantIds ?? null,
      filter.voucherId ?? null,
      filter.viewerId ?? null,
      filter.claims ?? 'any',
    ];
    const sql = {
      with: `
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
            AND ($6::uuid[] IS NULL OR coupon.merchant_id = ANY($6::uuid[]))
            AND ($7::uuid IS NULL OR coupon.id = $7)
          GROUP BY coupon.id
          HAVING coupon.max_uses IS NULL OR COUNT(usage.id) < coupon.max_uses
        )
      `,
      from: `
        FROM visible
        INNER JOIN coupons coupon ON coupon.id = visible.id
        INNER JOIN merchants merchant ON merchant.id = coupon.merchant_id
        LEFT JOIN merchant_profiles profile
          ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
        LEFT JOIN file_assets avatar
          ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
        LEFT JOIN coupon_claims claim
          ON claim.coupon_id = coupon.id
          AND claim.user_id = $8::uuid
          AND claim.deleted_at IS NULL
        WHERE ($3::varchar IS NULL OR profile.category_label = $3)
          AND ($4::varchar IS NULL OR profile.slug = $4)
          AND ($5::uuid IS NULL OR merchant.id = $5)
          AND ($9::text = 'any'
            OR ($9::text = 'claimed') = (claim.id IS NOT NULL))
      `,
    };
    return { sql, params };
  }

  private toVoucherResponse(row: VoucherRow): VoucherResponseDto {
    const now = new Date();
    const status = !row.is_active
      ? 'inactive'
      : row.starts_at && new Date(row.starts_at) > now
        ? 'scheduled'
        : row.ends_at && new Date(row.ends_at) <= now
          ? 'expired'
          : row.usage_limit !== null &&
              Number(row.used_count) >= Number(row.usage_limit)
            ? 'limit_reached'
            : 'active';
    return {
      ...row,
      discount_value: Number(row.discount_value),
      minimum_purchase: this.numberOrNull(row.minimum_purchase),
      maximum_discount_amount: this.numberOrNull(row.maximum_discount_amount),
      usage_limit: this.numberOrNull(row.usage_limit),
      used_count: Number(row.used_count),
      status,
    };
  }

  private toPublicVoucherResponse(
    row: PublicVoucherRow,
  ): PublicVoucherResponseDto {
    const { merchant_avatar_object_key, ...fields } = row;
    return {
      ...fields,
      merchant_avatar_url: assetUrl(merchant_avatar_object_key),
      discount_value: Number(row.discount_value),
      minimum_purchase: this.numberOrNull(row.minimum_purchase),
      maximum_discount_amount: this.numberOrNull(row.maximum_discount_amount),
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
  minimum_purchase: string | null;
  maximum_discount_amount: string | null;
  usage_limit: number | null;
  starts_at: Date | null;
  ends_at: Date | null;
  is_active: boolean;
  created_at: Date;
  used_count: number;
}

interface PublicVoucherRow {
  id: string;
  tag: string;
  name: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: string;
  minimum_purchase: string | null;
  maximum_discount_amount: string | null;
  ends_at: Date | null;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string | null;
  merchant_avatar_object_key: string | null;
  merchant_tagline: string | null;
  merchant_category_label: string | null;
  is_claimed: boolean;
}
