import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { merchantCategorySlugForLabel } from '~/common/constants/merchant-category';
import {
  RICH_TEXT_MAX_LENGTH,
  sanitizeRichText,
} from '../../common/html/sanitize-rich-text';
import { assetUrl } from '../../common/storage/asset-url';
import { uniqueSkills } from '../../common/util/skill-list';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import {
  MerchantLandingResponseDto,
  PublicMerchantLandingDto,
  MerchantResponseDto,
  NotificationPreferencesResponseDto,
} from './dto/merchant-response.dto';
import { PublicMerchantStorefrontResponseDto } from './dto/public-merchant-storefront-response.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import {
  BalanceHistoryQueryDto,
  BalanceHistoryType,
} from './dto/balance-history.dto';
import {
  LANDING_SECTIONS,
  assertLayoutItemsOwned,
  normalizeLandingLayout,
} from './merchant-landing';
import { MerchantMember } from './entities/merchant-member.entity';
import { MerchantSkill } from './entities/merchant-skill.entity';
import {
  LandingLayout,
  MerchantProfile,
} from './entities/merchant-profile.entity';
import { Merchant, MerchantStorageLevel } from './entities/merchant.entity';
import { MerchantLevelService } from '../merchant-level/merchant-level.service';
import { MerchantWallet } from './entities/merchant-wallet.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';

// Income is the merchant's net from items in paid orders (price minus the
// item's code discount share; digital products, classes, and bundles in
// separate branches so each uses its index); withdrawals are payouts.
const BALANCE_HISTORY_SQL = `
  SELECT item.id, 'income' AS type, item.price_at_purchase - item.discount_amount AS amount,
         'Penjualan ' || product.title AS description,
         purchase.created_at AS occurred_at, 'success' AS status
  FROM order_items item
  INNER JOIN products product ON product.id = item.product_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE product.merchant_id = $1 AND purchase.status = 'paid'
    AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT item.id, 'income', item.price_at_purchase - item.discount_amount,
         'Penjualan ' || class.title,
         purchase.created_at, 'success'
  FROM order_items item
  INNER JOIN classes class ON class.id = item.class_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE class.merchant_id = $1 AND purchase.status = 'paid'
    AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT item.id, 'income', item.price_at_purchase - item.discount_amount,
         'Penjualan ' || bundle.title,
         purchase.created_at, 'success'
  FROM order_items item
  INNER JOIN bundles bundle ON bundle.id = item.bundle_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE bundle.merchant_id = $1 AND purchase.status = 'paid'
    AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT payout.id, 'withdraw', payout.amount, payout.destination_bank_account,
         payout.requested_at, payout.status
  FROM merchant_payouts payout
  WHERE payout.merchant_id = $1 AND payout.deleted_at IS NULL
`;

interface BalanceHistoryRow {
  id: string;
  type: BalanceHistoryType;
  amount: string;
  description: string;
  occurred_at: Date;
  status: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class MerchantService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    @InjectRepository(MerchantWallet)
    private readonly wallets: Repository<MerchantWallet>,
    @InjectRepository(UserNotificationPreferences)
    private readonly notificationPreferences: Repository<UserNotificationPreferences>,
    private readonly merchantLevels: MerchantLevelService,
  ) {}

  async register(userId: string, input: RegisterMerchantDto) {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');

      const existing = await manager.findOne(Merchant, {
        where: { userId },
        withDeleted: true,
      });
      if (existing) throw new ConflictException('User already owns a merchant');

      const merchant = manager.create(Merchant, {
        userId,
        storeName: input.store_name,
        storeDescription: input.store_description,
        storageLevel: MerchantStorageLevel.BASIC,
        status: 'active',
      });
      await manager.save(Merchant, merchant);

      await manager.save(
        MerchantWallet,
        manager.create(MerchantWallet, {
          merchantId: merchant.id,
          earningBalance: '0',
          settledBalance: '0',
          lifetimeEarnings: '0',
        }),
      );

      await manager.save(
        MerchantProfile,
        manager.create(MerchantProfile, {
          merchantId: merchant.id,
          slug: await this.nextAvailableSlug(manager, input.store_name),
          needChangePassword:
            input.need_change_password === undefined
              ? false
              : input.need_change_password,
          termsAcceptedAt: new Date(),
          businessType: input.business_type,
          categoryLabel: input.category_label ?? null,
          city: input.city,
          publicPhone: input.public_phone,
          productTypes: input.product_types,
        }),
      );
      await manager.save(
        MerchantMember,
        manager.create(MerchantMember, {
          merchantId: merchant.id,
          userId,
          role: 'owner',
          status: 'active',
          joinedAt: new Date(),
        }),
      );

      const preferences = await manager.findOneBy(UserNotificationPreferences, {
        userId,
      });
      if (!preferences) {
        await manager.save(
          UserNotificationPreferences,
          manager.create(UserNotificationPreferences, { userId }),
        );
      }

      user.isMerchant = true;
      await manager.save(User, user);
    });

    return this.findMerchantProfile(userId).then((response) => ({
      ...response,
      responseMessage: 'Register merchant success',
    }));
  }

  async findMerchantProfile(userId: string) {
    await this.ensureMerchantProfile(userId);
    return {
      data: await this.findMerchantResponse(userId),
      responseMessage: 'Get merchant profile success',
    };
  }

  async findOwnMerchantId(userId: string): Promise<string> {
    const merchant = await this.merchants.findOneBy({ userId });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant.id;
  }

  async findWallet(userId: string) {
    const merchant = await this.merchants.findOneBy({ userId });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const wallet = await this.wallets.findOneBy({ merchantId: merchant.id });
    if (!wallet) throw new NotFoundException('Merchant wallet not found');

    const [withdrawn] = await this.wallets.query(
      `SELECT COALESCE(sum(amount), 0) AS total
       FROM merchant_payouts
       WHERE merchant_id = $1 AND status = 'success' AND deleted_at IS NULL`,
      [merchant.id],
    );

    const earningBalance = Number(wallet.earningBalance);
    const settledBalance = Number(wallet.settledBalance);

    return {
      data: {
        merchant_id: merchant.id,
        storage_level: merchant.storageLevel,
        earning_balance: earningBalance,
        settled_balance: settledBalance,
        clearing_balance: earningBalance - settledBalance,
        lifetime_earnings: Number(wallet.lifetimeEarnings),
        total_withdrawn: Number(withdrawn.total),
      },
      responseMessage: 'Get merchant wallet success',
    };
  }

  async findBalanceHistory(userId: string, query: BalanceHistoryQueryDto) {
    const merchant = await this.merchants.findOneBy({ userId });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const { type, page, limit } = query;
    const params = [merchant.id, type];

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total FROM (${BALANCE_HISTORY_SQL}) history
       WHERE ($2 = 'all' OR history.type = $2)`,
      params,
    );
    const total: number = countRow.total;

    const rows: BalanceHistoryRow[] =
      total === 0
        ? []
        : await this.dataSource.query(
            `SELECT * FROM (${BALANCE_HISTORY_SQL}) history
             WHERE ($2 = 'all' OR history.type = $2)
             ORDER BY history.occurred_at DESC, history.id DESC
             LIMIT $3 OFFSET $4`,
            [...params, limit, (page - 1) * limit],
          );

    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        description: row.description,
        occurred_at: row.occurred_at,
        status: row.status,
      })),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get balance history success',
    };
  }

  async updateMerchantProfile(userId: string, input: UpdateMerchantProfileDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findOwnedMerchant(manager, userId, true);
      let profile = await manager.findOneBy(MerchantProfile, {
        merchantId: merchant.id,
      });
      if (!profile) {
        profile = manager.create(MerchantProfile, {
          merchantId: merchant.id,
          slug: await this.nextAvailableSlug(manager, merchant.storeName),
        });
      }

      if (input.store_name !== undefined) merchant.storeName = input.store_name;
      if (input.store_description !== undefined) {
        merchant.storeDescription =
          input.store_description === null
            ? null
            : this.sanitizeDescription(input.store_description);
      }
      if (input.phone !== undefined) {
        await this.savePrivatePhone(manager, userId, input.phone);
      }

      if (input.avatar_asset_id !== undefined) {
        if (input.avatar_asset_id !== null) {
          await assertOwnedAsset(
            manager,
            userId,
            input.avatar_asset_id,
            'merchant_logo',
          );
        }
        profile.avatarAssetId = input.avatar_asset_id;
      }
      if (input.cover_asset_id !== undefined) {
        if (input.cover_asset_id !== null) {
          await assertOwnedAsset(
            manager,
            userId,
            input.cover_asset_id,
            'merchant_banner',
          );
        }
        profile.coverAssetId = input.cover_asset_id;
      }
      if (input.tagline !== undefined) profile.tagline = input.tagline;
      if (input.category_label !== undefined)
        profile.categoryLabel = input.category_label;
      if (input.city !== undefined) profile.city = input.city;
      if (input.business_type !== undefined)
        profile.businessType = input.business_type;
      if (input.product_types !== undefined)
        profile.productTypes = input.product_types;
      if (input.public_email !== undefined)
        profile.publicEmail = input.public_email;
      if (input.public_phone !== undefined)
        profile.publicPhone = input.public_phone;
      if (input.website_url !== undefined)
        profile.websiteUrl = input.website_url;
      if (input.instagram_handle !== undefined) {
        profile.instagramHandle = input.instagram_handle;
      }
      if (input.youtube_url !== undefined)
        profile.youtubeUrl = input.youtube_url;
      if (input.linkedin_url !== undefined)
        profile.linkedinUrl = input.linkedin_url;
      if (input.expertise !== undefined) profile.expertise = input.expertise;
      if (input.experience_years !== undefined) {
        profile.experienceYears = input.experience_years;
      }
      if (input.education !== undefined) profile.education = input.education;
      if (input.portfolio_url !== undefined)
        profile.portfolioUrl = input.portfolio_url;
      if (input.refund_policy !== undefined)
        profile.refundPolicy = input.refund_policy;
      if (input.digital_license !== undefined) {
        profile.digitalLicense = input.digital_license;
      }

      if (input.landing_background_asset_id !== undefined) {
        if (input.landing_background_asset_id !== null) {
          await assertOwnedAsset(
            manager,
            userId,
            input.landing_background_asset_id,
            'merchant_landing_background',
          );
        }
        profile.landingBackgroundAssetId = input.landing_background_asset_id;
      }
      if (input.landing_layout !== undefined) {
        if (input.landing_layout === null) {
          profile.landingLayout = null;
        } else {
          const layout = normalizeLandingLayout(input.landing_layout);
          await assertLayoutItemsOwned(manager, merchant.id, layout);
          profile.landingLayout = layout;
        }
      }

      await manager.save(Merchant, merchant);
      await manager.save(MerchantProfile, profile);
      if (input.skills !== undefined) {
        await this.replaceSkills(manager, merchant.id, input.skills);
      }
    });

    return this.findMerchantProfile(userId).then((response) => ({
      ...response,
      responseMessage: 'Update merchant profile success',
    }));
  }

  // The frontend opens the page by merchant id; older links use the slug.
  async findPublicStorefront(merchantKey: string, viewerId?: string) {
    const byId = UUID_PATTERN.test(merchantKey);
    const [row] = (await this.dataSource.query(
      `
        SELECT
          merchant.id, merchant.user_id AS owner_user_id,
          merchant.store_name, merchant.store_description, merchant.created_at,
          profile.slug, profile.tagline, profile.category_label,
          profile.city, profile.public_email, profile.public_phone,
          profile.website_url, profile.instagram_handle, profile.youtube_url,
          profile.linkedin_url, profile.expertise,
          avatar_asset.object_key AS avatar_object_key,
          cover_asset.object_key AS cover_object_key,
          landing_asset.object_key AS landing_background_object_key,
          profile.landing_layout,
          COALESCE((
            SELECT json_agg(skill.name ORDER BY skill.sort_order, skill.created_at)
            FROM merchant_skills skill
            WHERE skill.merchant_id = merchant.id AND skill.deleted_at IS NULL
          ), '[]'::json) AS skills,
          (
            SELECT count(DISTINCT learner.user_id)::integer FROM (
              SELECT enrollment.user_id FROM enrollments enrollment
              INNER JOIN classes class ON class.id = enrollment.class_id
              WHERE class.merchant_id = merchant.id AND class.deleted_at IS NULL
                AND class.status = 'published' AND enrollment.deleted_at IS NULL
              UNION
              SELECT access.user_id FROM user_access access
              INNER JOIN products product ON product.id = access.product_id
              WHERE product.merchant_id = merchant.id AND product.deleted_at IS NULL
                AND product.is_published = true AND product.publication_status = 'published'
                AND access.deleted_at IS NULL
                AND (access.expires_at IS NULL OR access.expires_at > now())
            ) learner
          ) AS total_students,
          (
            SELECT count(*)::integer FROM classes class
            WHERE class.merchant_id = merchant.id AND class.deleted_at IS NULL
              AND class.status = 'published'
          ) AS published_class_count,
          (
            SELECT count(*)::integer FROM products product
            WHERE product.merchant_id = merchant.id AND product.deleted_at IS NULL
              AND product.is_published = true AND product.publication_status = 'published'
          ) AS published_digital_product_count,
          reviewed.average_rating, reviewed.review_count
        FROM merchants merchant
        INNER JOIN merchant_profiles profile
          ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
        LEFT JOIN file_assets avatar_asset
          ON avatar_asset.id = profile.avatar_asset_id AND avatar_asset.deleted_at IS NULL
        LEFT JOIN file_assets cover_asset
          ON cover_asset.id = profile.cover_asset_id AND cover_asset.deleted_at IS NULL
        LEFT JOIN file_assets landing_asset
          ON landing_asset.id = profile.landing_background_asset_id
          AND landing_asset.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT COALESCE(round(avg(review.rating)::numeric, 1), 0) AS average_rating,
                 count(*)::integer AS review_count
          FROM reviews review
          LEFT JOIN classes class ON class.id = review.class_id
            AND class.deleted_at IS NULL AND class.status = 'published'
          LEFT JOIN products product ON product.id = review.product_id
            AND product.deleted_at IS NULL AND product.is_published = true
            AND product.publication_status = 'published'
          WHERE review.deleted_at IS NULL
            AND (class.merchant_id = merchant.id OR product.merchant_id = merchant.id)
        ) reviewed ON true
        WHERE ${byId ? 'merchant.id = $1::uuid' : 'profile.slug = $1'}
          AND merchant.deleted_at IS NULL
          AND merchant.status = 'active'
        LIMIT 1
      `,
      [merchantKey],
    )) as StorefrontRow[];
    if (!row) throw new NotFoundException('Merchant not found');

    const layout = await this.visibleLandingLayout(row.id, row.landing_layout);
    return {
      data: this.toStorefrontResponse(row, layout, viewerId),
      responseMessage: 'Get public merchant success',
    };
  }

  async findNotificationPreferences(userId: string) {
    await this.assertMerchantOwner(userId);
    const preferences = await this.notificationPreferences.findOneBy({
      userId,
    });
    return {
      data: this.toNotificationPreferences(preferences),
      responseMessage: 'Get notification preferences success',
    };
  }

  async updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferencesDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.findOwnedMerchant(manager, userId, true);
      let preferences = await manager.findOneBy(UserNotificationPreferences, {
        userId,
      });
      if (!preferences) {
        preferences = manager.create(UserNotificationPreferences, { userId });
      }

      if (input.email_new_sale !== undefined) {
        preferences.emailNewSale = input.email_new_sale;
      }
      if (input.email_new_applicant !== undefined) {
        preferences.emailNewApplicant = input.email_new_applicant;
      }
      if (input.email_new_review !== undefined) {
        preferences.emailNewReview = input.email_new_review;
      }
      if (input.email_weekly_report !== undefined) {
        preferences.emailWeeklyReport = input.email_weekly_report;
      }
      if (input.whatsapp_new_order !== undefined) {
        preferences.whatsappNewOrder = input.whatsapp_new_order;
      }
      if (input.whatsapp_payout_approved !== undefined) {
        preferences.whatsappPayoutApproved = input.whatsapp_payout_approved;
      }
      if (input.whatsapp_student_chat !== undefined) {
        preferences.whatsappStudentChat = input.whatsapp_student_chat;
      }
      if (input.promotion_broadcast !== undefined) {
        preferences.promotionBroadcast = input.promotion_broadcast;
      }
      await manager.save(UserNotificationPreferences, preferences);
    });

    return this.findNotificationPreferences(userId).then((response) => ({
      ...response,
      responseMessage: 'Update notification preferences success',
    }));
  }

  private async ensureMerchantProfile(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findOwnedMerchant(manager, userId, true);
      const profile = await manager.findOneBy(MerchantProfile, {
        merchantId: merchant.id,
      });
      if (!profile) {
        await manager.save(
          MerchantProfile,
          manager.create(MerchantProfile, {
            merchantId: merchant.id,
            slug: await this.nextAvailableSlug(manager, merchant.storeName),
          }),
        );
      }
    });
  }

  private async findMerchantResponse(
    userId: string,
  ): Promise<MerchantResponseDto> {
    const row = await this.merchants
      .createQueryBuilder('merchant')
      .innerJoin(
        MerchantProfile,
        'profile',
        'profile.merchant_id = merchant.id AND profile.deleted_at IS NULL',
      )
      .leftJoin(
        Profile,
        'user_profile',
        'user_profile.user_id = merchant.user_id AND user_profile.deleted_at IS NULL',
      )
      .leftJoin(
        FileAsset,
        'avatar_asset',
        'avatar_asset.id = profile.avatar_asset_id AND avatar_asset.deleted_at IS NULL',
      )
      .leftJoin(
        FileAsset,
        'cover_asset',
        'cover_asset.id = profile.cover_asset_id AND cover_asset.deleted_at IS NULL',
      )
      .leftJoin(
        FileAsset,
        'landing_asset',
        'landing_asset.id = profile.landing_background_asset_id AND landing_asset.deleted_at IS NULL',
      )
      .select([
        'merchant.id AS id',
        'merchant.store_name AS store_name',
        'merchant.store_description AS store_description',
        'merchant.status AS status',
        'merchant.storage_level AS storage_level',
        'profile.slug AS slug',
        'user_profile.phone AS phone',
        'profile.tagline AS tagline',
        'profile.category_label AS category_label',
        'profile.city AS city',
        'profile.public_email AS public_email',
        'profile.public_phone AS public_phone',
        'profile.website_url AS website_url',
        'profile.instagram_handle AS instagram_handle',
        'profile.youtube_url AS youtube_url',
        'profile.linkedin_url AS linkedin_url',
        'profile.expertise AS expertise',
        'profile.experience_years AS experience_years',
        'profile.education AS education',
        'profile.portfolio_url AS portfolio_url',
        'profile.refund_policy AS refund_policy',
        'profile.digital_license AS digital_license',
        'profile.need_change_password AS need_change_password',
        'profile.terms_accepted_at AS terms_accepted_at',
        'profile.business_type AS business_type',
        'profile.product_types AS product_types',
        'profile.avatar_asset_id AS avatar_asset_id',
        'avatar_asset.object_key AS avatar_object_key',
        'profile.cover_asset_id AS cover_asset_id',
        'cover_asset.object_key AS cover_object_key',
        'profile.landing_background_asset_id AS landing_background_asset_id',
        'landing_asset.object_key AS landing_background_object_key',
        'profile.landing_layout AS landing_layout',
      ])
      .where('merchant.user_id = :userId', { userId })
      .andWhere('merchant.deleted_at IS NULL')
      .getRawOne<MerchantRow>();
    if (!row) throw new NotFoundException('Merchant not found');

    const {
      avatar_object_key,
      cover_object_key,
      landing_background_asset_id,
      landing_background_object_key,
      landing_layout,
      ...merchant
    } = row;
    return {
      ...merchant,
      experience_years:
        row.experience_years === null ? null : Number(row.experience_years),
      avatar_url: assetUrl(avatar_object_key),
      cover_url: assetUrl(cover_object_key),
      skills: await this.findSkills(row.id),
      level: await this.merchantLevels.findSummary(row.id),
      landing: this.toLanding(
        landing_background_asset_id,
        landing_background_object_key,
        landing_layout,
      ),
    };
  }

  private sanitizeDescription(description: string): string {
    const sanitized = sanitizeRichText(description);
    if (!sanitized) {
      throw new BadRequestException('store_description must contain text');
    }
    if (sanitized.length > RICH_TEXT_MAX_LENGTH) {
      throw new BadRequestException(
        `store_description must not exceed ${RICH_TEXT_MAX_LENGTH} characters`,
      );
    }
    return sanitized;
  }

  // Runs inside the merchant-row transaction, so concurrent edits serialize.
  // The list is replaced as a whole; old rows are removed because
  // (merchant_id, name) stays unique across soft-deleted rows.
  private async replaceSkills(
    manager: EntityManager,
    merchantId: string,
    skills: string[],
  ): Promise<void> {
    await manager.delete(MerchantSkill, { merchantId });
    const names = uniqueSkills(skills);
    if (names.length === 0) return;
    await manager.insert(
      MerchantSkill,
      names.map((name, position) => ({
        merchantId,
        name,
        sortOrder: position,
      })),
    );
  }

  private async findSkills(merchantId: string): Promise<string[]> {
    const skills = await this.dataSource.manager.find(MerchantSkill, {
      where: { merchantId },
      order: { sortOrder: 'ASC', created_at: 'ASC' },
    });
    return skills.map((skill) => skill.name);
  }

  // Drops ordered items that were deleted or unpublished after being saved.
  private async visibleLandingLayout(
    merchantId: string,
    layout: LandingLayout | null,
  ): Promise<LandingLayout | null> {
    const ids = Object.values(layout?.item_order ?? {}).flat();
    if (!layout || ids.length === 0) return layout;

    const visible: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM classes
       WHERE merchant_id = $1 AND id = ANY($2::uuid[])
         AND deleted_at IS NULL AND status = 'published'
       UNION ALL
       SELECT id FROM products
       WHERE merchant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
         AND is_published = true AND publication_status = 'published'
       UNION ALL
       SELECT id FROM bundles
       WHERE merchant_id = $1 AND id = ANY($2::uuid[])
         AND deleted_at IS NULL AND status = 'published'`,
      [merchantId, ids],
    );
    const visibleIds = new Set(visible.map((row) => row.id));
    return {
      section_order: layout.section_order,
      item_order: Object.fromEntries(
        Object.entries(layout.item_order).map(([section, sectionIds]) => [
          section,
          sectionIds.filter((id) => visibleIds.has(id)),
        ]),
      ),
    };
  }

  private toLanding(
    backgroundAssetId: string | null,
    backgroundObjectKey: string | null,
    layout: LandingLayout | null,
  ): MerchantLandingResponseDto {
    return {
      background_asset_id: backgroundAssetId,
      background_url: assetUrl(backgroundObjectKey),
      section_order: layout?.section_order ?? [...LANDING_SECTIONS],
      item_order: layout?.item_order ?? {},
    };
  }

  private toPublicLanding(
    backgroundObjectKey: string | null,
    layout: LandingLayout | null,
  ): PublicMerchantLandingDto {
    return {
      background_url: assetUrl(backgroundObjectKey),
      section_order: layout?.section_order ?? [...LANDING_SECTIONS],
      item_order: layout?.item_order ?? {},
    };
  }

  private async assertMerchantOwner(userId: string): Promise<void> {
    const merchant = await this.merchants.findOneBy({ userId });
    if (!merchant) throw new NotFoundException('Merchant not found');
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

  private async savePrivatePhone(
    manager: EntityManager,
    userId: string,
    phone: string | null,
  ): Promise<void> {
    const profile = await manager.findOneBy(Profile, { userId });
    await manager.save(
      Profile,
      profile
        ? Object.assign(profile, { phone })
        : manager.create(Profile, { userId, phone }),
    );
  }

  private async nextAvailableSlug(
    manager: EntityManager,
    storeName: string,
  ): Promise<string> {
    const baseSlug = this.toSlug(storeName);
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      baseSlug,
    ]);
    const rows = (await manager.query(
      'SELECT slug FROM merchant_profiles WHERE slug = $1 OR slug ~ $2',
      [baseSlug, `^${baseSlug}-[0-9]+$`],
    )) as Array<{ slug: string }>;
    const used = new Set(rows.map((row) => row.slug));
    if (!used.has(baseSlug)) return baseSlug;

    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${baseSlug}-${suffix}`;
      if (!used.has(candidate)) return candidate;
    }
  }

  private toSlug(value: string): string {
    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    return slug || 'merchant';
  }

  private toStorefrontResponse(
    row: StorefrontRow,
    layout: LandingLayout | null,
    viewerId: string | undefined,
  ): PublicMerchantStorefrontResponseDto {
    const {
      owner_user_id,
      avatar_object_key,
      cover_object_key,
      landing_background_object_key,
      landing_layout,
      ...storefront
    } = row;
    return {
      ...storefront,
      category_slug: merchantCategorySlugForLabel(row.category_label),
      avatar_url: assetUrl(avatar_object_key),
      cover_url: assetUrl(cover_object_key),
      skills: row.skills ?? [],
      landing: this.toPublicLanding(
        landing_background_object_key,
        layout ?? landing_layout,
      ),
      is_owner: !!viewerId && viewerId === owner_user_id,
      total_students: Number(row.total_students),
      published_class_count: Number(row.published_class_count),
      published_digital_product_count: Number(
        row.published_digital_product_count,
      ),
      average_rating: Number(row.average_rating),
      review_count: Number(row.review_count),
    };
  }

  private toNotificationPreferences(
    preferences: UserNotificationPreferences | null,
  ): NotificationPreferencesResponseDto {
    return {
      email_new_sale: preferences?.emailNewSale ?? true,
      email_new_applicant: preferences?.emailNewApplicant ?? true,
      email_new_review: preferences?.emailNewReview ?? true,
      email_weekly_report: preferences?.emailWeeklyReport ?? true,
      whatsapp_new_order: preferences?.whatsappNewOrder ?? true,
      whatsapp_payout_approved: preferences?.whatsappPayoutApproved ?? true,
      whatsapp_student_chat: preferences?.whatsappStudentChat ?? false,
      promotion_broadcast: preferences?.promotionBroadcast ?? true,
    };
  }
}

interface MerchantRow
  extends Omit<
    MerchantResponseDto,
    'experience_years' | 'avatar_url' | 'cover_url' | 'skills' | 'landing'
  > {
  experience_years: string | null;
  avatar_object_key: string | null;
  cover_object_key: string | null;
  landing_background_asset_id: string | null;
  landing_background_object_key: string | null;
  landing_layout: LandingLayout | null;
}

interface StorefrontRow
  extends Omit<
    PublicMerchantStorefrontResponseDto,
    | 'category_slug'
    | 'avatar_url'
    | 'cover_url'
    | 'landing'
    | 'is_owner'
    | 'total_students'
    | 'published_class_count'
    | 'published_digital_product_count'
    | 'average_rating'
    | 'review_count'
  > {
  owner_user_id: string;
  avatar_object_key: string | null;
  cover_object_key: string | null;
  landing_background_object_key: string | null;
  landing_layout: LandingLayout | null;
  total_students: number | string;
  published_class_count: number | string;
  published_digital_product_count: number | string;
  average_rating: number | string;
  review_count: number | string;
}
