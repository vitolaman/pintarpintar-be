import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { Bundle } from '../bundle/entities/bundle.entity';
import { Discount } from '../discount/entities/discount.entity';
import { PAID_SALES_SQL } from '../merchant-dashboard/merchant-sales-sql';
import {
  Merchant,
  MerchantStorageLevel,
} from '../merchant/entities/merchant.entity';
import { Notification } from '../notification/entities/notification.entity';
import { Product } from '../profile/entities/product.entity';
import { UserAccess } from '../profile/entities/user-access.entity';
import { Voucher } from '../voucher/entities/voucher.entity';
import { Class } from '~/class/entities/class.entity';
import {
  InactivityAction,
  MerchantLevelEvaluation,
} from './entities/merchant-level-evaluation.entity';
import {
  GOLD_MONTHLY_REVENUE,
  MERCHANT_LEVEL_RULES,
  SILVER_MONTHLY_REVENUE,
  inactivityAction,
  nextLevel,
} from './merchant-level-rules';
import { merchantStorageUse } from './merchant-storage';
import {
  LevelEvaluationQueryDto,
  MerchantLevelSummaryDto,
} from './dto/merchant-level.dto';

// Paid sales of merchant $1 with their sale time in Asia/Jakarta.
const LOCAL_SALES_SQL = `
  SELECT sale.amount, (sale.sold_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta' AS sold_local
  FROM (${PAID_SALES_SQL}) sale
`;

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

type MonthFacts = {
  revenue: string;
  sales: number;
  previous_revenue: string;
  previous_sales: number;
  first_counted_month: string;
  has_items: boolean;
};

/**
 * Monthly merchant level evaluation (Asia/Jakarta calendar months). Each
 * merchant and month is evaluated once: the merchant row is locked with SKIP
 * LOCKED and the evaluation row is unique per merchant and month, so
 * overlapping runs on several instances never apply a month twice.
 */
@Injectable()
export class MerchantLevelService {
  private readonly logger = new Logger(MerchantLevelService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Evaluates the month that just ended for every merchant not yet evaluated. */
  async evaluateEndedMonth(): Promise<number> {
    const [{ period }] = await this.dataSource.query(
      `SELECT (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') - interval '1 month')::date::text AS period`,
    );
    return this.evaluateMonth(period);
  }

  /** `period` is the first day of the month to evaluate (YYYY-MM-01). */
  async evaluateMonth(period: string): Promise<number> {
    const merchants: { id: string }[] = await this.dataSource.query(
      `SELECT merchant.id FROM merchants merchant
       WHERE merchant.deleted_at IS NULL AND merchant.status = 'active'
         AND (merchant.level_tracked_from AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta'
             < $1::date + interval '1 month'
         AND NOT EXISTS (
           SELECT 1 FROM merchant_level_evaluations evaluation
           WHERE evaluation.merchant_id = merchant.id AND evaluation.period_month = $1::date)
       ORDER BY merchant.id`,
      [period],
    );

    let evaluated = 0;
    for (const { id } of merchants) {
      try {
        if (await this.evaluateMerchant(id, period)) evaluated++;
      } catch (error) {
        this.logger.error(
          `Level evaluation of merchant ${id} failed: ${error}`,
        );
      }
    }
    return evaluated;
  }

  /** Returns false when another run holds or already evaluated the merchant. */
  async evaluateMerchant(merchantId: string, period: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const merchant = await manager.findOne(Merchant, {
        where: { id: merchantId },
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      if (!merchant) return false;
      const done = await manager.exists(MerchantLevelEvaluation, {
        where: { merchantId, periodMonth: period },
      });
      if (done) return false;

      const previousPeriod = addMonths(period, -1);
      const facts = await this.monthFacts(manager, merchantId, period);
      const previous = await manager.findOneBy(MerchantLevelEvaluation, {
        merchantId,
        periodMonth: previousPeriod,
      });
      const lastRemoval = await manager.findOne(MerchantLevelEvaluation, {
        where: { merchantId, inactivityAction: 'removed' },
        order: { periodMonth: 'DESC' },
      });
      const countedFrom =
        lastRemoval &&
        addMonths(lastRemoval.periodMonth, 1) > facts.first_counted_month
          ? addMonths(lastRemoval.periodMonth, 1)
          : facts.first_counted_month;

      const revenue = Number(facts.revenue);
      const previousRevenue = Number(facts.previous_revenue);
      const newLevel = nextLevel(
        merchant.storageLevel,
        revenue,
        previousRevenue,
      );
      const action = inactivityAction({
        hasItems: facts.has_items,
        monthHasSale: facts.sales > 0,
        previousMonthHasSale: facts.previous_sales > 0,
        monthCounted: period >= countedFrom,
        previousMonthCounted: previousPeriod >= countedFrom,
        previousAction: previous?.inactivityAction ?? null,
      });
      const removedItems =
        action === 'removed' ? await this.removeItems(manager, merchantId) : 0;

      const evaluation = await manager.save(
        MerchantLevelEvaluation,
        manager.create(MerchantLevelEvaluation, {
          merchantId,
          periodMonth: period,
          revenue: String(revenue),
          previousMonthRevenue: String(previousRevenue),
          previousLevel: merchant.storageLevel,
          newLevel,
          inactivityAction: action,
          removedItems,
        }),
      );
      if (newLevel !== merchant.storageLevel) {
        await manager.update(
          Merchant,
          { id: merchantId },
          { storageLevel: newLevel },
        );
      }
      await manager.save(
        Notification,
        evaluationNotices(evaluation, period).map((notice) =>
          manager.create(Notification, {
            ...notice,
            userId: merchant.userId,
            refType: 'merchant_level_evaluation',
            refId: evaluation.id,
            isRead: false,
          }),
        ),
      );
      this.logger.log(
        `Merchant ${merchantId} ${period}: ${merchant.storageLevel} -> ${newLevel}, ${action}${removedItems ? ` (${removedItems} items removed)` : ''}`,
      );
      return true;
    });
  }

  async findSummary(merchantId: string): Promise<MerchantLevelSummaryDto> {
    const [row] = await this.dataSource.query(
      `SELECT merchant.storage_level,
              (SELECT COALESCE(sum(sale.amount), 0) FROM (${LOCAL_SALES_SQL}) sale
               WHERE sale.sold_local >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta')) AS current_month_revenue,
              latest.period_month::text AS last_period,
              latest.inactivity_action,
              to_char(date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') + interval '1 month 30 minutes',
                      'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') AS next_evaluation_at
       FROM merchants merchant
       LEFT JOIN LATERAL (
         SELECT period_month, inactivity_action FROM merchant_level_evaluations
         WHERE merchant_id = merchant.id AND deleted_at IS NULL
         ORDER BY period_month DESC LIMIT 1
       ) latest ON true
       WHERE merchant.id = $1`,
      [merchantId],
    );
    if (!row) throw new NotFoundException('Merchant not found');
    const { usedBytes } = await merchantStorageUse(this.dataSource, merchantId);
    const level = row.storage_level as MerchantStorageLevel;
    const rule = MERCHANT_LEVEL_RULES[level];
    return {
      current: level,
      current_month_revenue: Number(row.current_month_revenue),
      silver_threshold: SILVER_MONTHLY_REVENUE,
      gold_threshold: GOLD_MONTHLY_REVENUE,
      max_upload_bytes: rule.maxUploadBytes,
      storage_quota_bytes: rule.storageQuotaBytes,
      storage_used_bytes: usedBytes,
      last_evaluated_month: row.last_period
        ? row.last_period.slice(0, 7)
        : null,
      next_evaluation_at: row.next_evaluation_at,
      inactivity_warning: row.inactivity_action === 'warning',
    };
  }

  async findOwnEvaluations(userId: string, query: LevelEvaluationQueryDto) {
    const merchant = await this.dataSource.manager.findOneBy(Merchant, {
      userId,
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const { page, limit } = query;
    const [rows, total] = await this.dataSource.manager.findAndCount(
      MerchantLevelEvaluation,
      {
        where: { merchantId: merchant.id },
        order: { periodMonth: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );
    return {
      data: rows.map((row) => ({
        id: row.id,
        month: row.periodMonth.slice(0, 7),
        revenue: Number(row.revenue),
        previous_month_revenue: Number(row.previousMonthRevenue),
        previous_level: row.previousLevel,
        new_level: row.newLevel,
        inactivity_action: row.inactivityAction,
        removed_items: row.removedItems,
        evaluated_at: row.created_at,
      })),
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
      responseMessage: 'Get level evaluations success',
    };
  }

  private async monthFacts(
    manager: EntityManager,
    merchantId: string,
    period: string,
  ): Promise<MonthFacts> {
    const [row] = await manager.query(
      `SELECT
         COALESCE(sum(sale.amount) FILTER (WHERE sale.sold_local >= $2::date AND sale.sold_local < $2::date + interval '1 month'), 0) AS revenue,
         count(sale.amount) FILTER (WHERE sale.sold_local >= $2::date AND sale.sold_local < $2::date + interval '1 month')::integer AS sales,
         COALESCE(sum(sale.amount) FILTER (WHERE sale.sold_local >= $2::date - interval '1 month' AND sale.sold_local < $2::date), 0) AS previous_revenue,
         count(sale.amount) FILTER (WHERE sale.sold_local >= $2::date - interval '1 month' AND sale.sold_local < $2::date)::integer AS previous_sales,
         (SELECT (date_trunc('month', (level_tracked_from AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') + interval '1 month')::date::text
          FROM merchants WHERE id = $1) AS first_counted_month,
         (EXISTS (SELECT 1 FROM products WHERE merchant_id = $1 AND deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM classes WHERE merchant_id = $1 AND deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM bundles WHERE merchant_id = $1 AND deleted_at IS NULL)) AS has_items
       FROM (${LOCAL_SALES_SQL}) sale`,
      [merchantId, period],
    );
    return row;
  }

  /**
   * Soft-deletes the merchant's digital products, classes and bundles, ends
   * buyers' access to the removed products and deactivates its discounts and
   * vouchers. Stored files, orders, wallets and reviews are kept.
   */
  private async removeItems(
    manager: EntityManager,
    merchantId: string,
  ): Promise<number> {
    const live = { merchantId, deleted_at: IsNull() };
    const products = await manager.find(Product, {
      where: live,
      select: { id: true },
    });
    const productIds = products.map((product) => product.id);

    await manager.update(Bundle, live, { status: 'unpublished' });
    const bundles = await manager.softDelete(Bundle, live);
    await manager.update(Product, live, { isPublished: false });
    const removedProducts = await manager.softDelete(Product, live);
    if (productIds.length > 0) {
      await manager.softDelete(UserAccess, {
        productId: In(productIds),
        deleted_at: IsNull(),
      });
    }
    const classes = await manager.softDelete(Class, {
      merchant_id: merchantId,
      deleted_at: IsNull(),
    });
    await manager.update(
      Discount,
      { merchantId, isActive: true },
      { isActive: false },
    );
    await manager.update(
      Voucher,
      { merchantId, isActive: true },
      { isActive: false },
    );

    return (
      (bundles.affected ?? 0) +
      (removedProducts.affected ?? 0) +
      (classes.affected ?? 0)
    );
  }
}

/** Adds months to a YYYY-MM-01 date string. */
export function addMonths(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function rupiah(amount: number): string {
  return `Rp ${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

type Notice = Pick<Notification, 'type' | 'title' | 'body'>;

// Indonesian texts for the merchant owner; the PM's sender emails them.
function evaluationNotices(
  evaluation: MerchantLevelEvaluation,
  period: string,
): Notice[] {
  const month = monthLabel(period);
  const before = MERCHANT_LEVEL_RULES[evaluation.previousLevel].label;
  const after = MERCHANT_LEVEL_RULES[evaluation.newLevel].label;
  const notices: Notice[] = [
    {
      type: 'merchant_level_evaluated',
      title: `Level merchant ${month}: ${after}`,
      body:
        `Pendapatan toko Anda pada ${month} adalah ${rupiah(Number(evaluation.revenue))}. ` +
        (before === after
          ? `Level Anda tetap ${after}.`
          : `Level Anda berubah dari ${before} menjadi ${after}.`),
    },
  ];
  const action: InactivityAction = evaluation.inactivityAction;
  if (action === 'warning') {
    notices.push({
      type: 'merchant_inactivity_warning',
      title: 'Peringatan: belum ada penjualan',
      body: `Toko Anda belum memiliki penjualan selama dua bulan terakhir. Jika ${monthLabel(addMonths(period, 1))} juga tidak ada penjualan, semua produk digital, kelas, bootcamp, dan bundle akan dihapus, serta diskon dan voucher dinonaktifkan.`,
    });
  }
  if (action === 'removed') {
    notices.push({
      type: 'merchant_items_removed',
      title: 'Produk toko dihapus',
      body: `Karena tidak ada penjualan selama tiga bulan, ${evaluation.removedItems} produk digital, kelas, bootcamp, dan bundle telah dihapus, serta diskon dan voucher dinonaktifkan.`,
    });
  }
  return notices;
}
