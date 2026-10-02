import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TrackVisitDto, VisitTarget } from './dto/merchant-analytics.dto';
import { MerchantVisit } from './entities/merchant-visit.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Crawlers, link previews and scripted clients are not visitors.
const BOT_USER_AGENT =
  /bot|crawler|spider|crawling|preview|facebookexternalhit|curl|wget|python-requests|headless/i;

// Visibility follows the public catalog and storefront: active merchants,
// published or archived (unlisted) classes, published digital products, and
// published or unlisted bundles.
const ACTIVE_MERCHANT_SQL = `merchant.deleted_at IS NULL AND merchant.status = 'active'`;
const STOREFRONT_TARGET_SQL = {
  byId: `SELECT merchant.id, merchant.user_id FROM merchants merchant
    WHERE merchant.id = $1::uuid AND ${ACTIVE_MERCHANT_SQL}`,
  bySlug: `SELECT merchant.id, merchant.user_id FROM merchant_profiles profile
    INNER JOIN merchants merchant ON merchant.id = profile.merchant_id
    WHERE profile.slug = $1 AND profile.deleted_at IS NULL AND ${ACTIVE_MERCHANT_SQL}`,
};
const CLASS_TARGET_SQL = `SELECT merchant.id, merchant.user_id FROM classes class
    INNER JOIN merchants merchant ON merchant.id = class.merchant_id
    WHERE class.id = $1::uuid AND class.deleted_at IS NULL
      AND class.status IN ('published', 'archived') AND ${ACTIVE_MERCHANT_SQL}`;
// The visit counts for the merchant, so a class page is resolved by id
// whichever class kind the page reports.
const ITEM_TARGET_SQL: Record<Exclude<VisitTarget, 'storefront'>, string> = {
  kelas: CLASS_TARGET_SQL,
  bootcamp: CLASS_TARGET_SQL,
  digital: `SELECT merchant.id, merchant.user_id FROM products product
    INNER JOIN merchants merchant ON merchant.id = product.merchant_id
    WHERE product.id = $1::uuid AND product.deleted_at IS NULL
      AND product.is_published = true AND product.publication_status = 'published'
      AND ${ACTIVE_MERCHANT_SQL}`,
  bundle: `SELECT merchant.id, merchant.user_id FROM bundles bundle
    INNER JOIN merchants merchant ON merchant.id = bundle.merchant_id
    WHERE bundle.id = $1::uuid AND bundle.deleted_at IS NULL
      AND bundle.status IN ('published', 'unlisted') AND ${ACTIVE_MERCHANT_SQL}`,
};

@Injectable()
export class VisitTrackingService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async track(
    input: TrackVisitDto,
    userId: string | null,
    userAgent: string | undefined,
  ) {
    if (!userId && !input.visitor_id) {
      throw new BadRequestException(
        'visitor_id is required when the request has no login token',
      );
    }
    const merchant = await this.findTargetMerchant(input);
    if (!merchant) throw new NotFoundException('Page not found');

    const ignored =
      merchant.user_id === userId || BOT_USER_AGENT.test(userAgent ?? '');
    if (!ignored) {
      // One row per merchant, visitor and Asia/Jakarta day; repeats are no-ops.
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(MerchantVisit)
        .values({
          merchantId: merchant.id,
          visitorKey: userId ? `user:${userId}` : `anon:${input.visitor_id}`,
          userId,
          visitDate: () => `(now() AT TIME ZONE 'Asia/Jakarta')::date`,
        })
        .orIgnore()
        .execute();
    }
    return {
      data: { recorded: !ignored },
      responseMessage: 'Track visit success',
    };
  }

  private async findTargetMerchant(
    input: TrackVisitDto,
  ): Promise<{ id: string; user_id: string } | undefined> {
    const isUuid = UUID.test(input.target_id);
    let sql: string;
    if (input.target_type === 'storefront') {
      sql = isUuid ? STOREFRONT_TARGET_SQL.byId : STOREFRONT_TARGET_SQL.bySlug;
    } else {
      if (!isUuid) return undefined;
      sql = ITEM_TARGET_SQL[input.target_type];
    }
    const [merchant] = await this.dataSource.query(sql, [input.target_id]);
    return merchant;
  }
}
