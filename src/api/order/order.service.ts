import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { OrderDetailResponseDto } from './dto/checkout.dto';
import {
  RecentTransactionsQueryDto,
  TransactionResponseDto,
  TransactionsQueryDto,
} from './dto/recent-transactions.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { assetUrl } from '~/common/storage/asset-url';
import { classKindSql } from '~/common/catalog/item-kind';

// An unpaid order past its expiry reads as expired even before the sweep
// records it.
const EFFECTIVE_STATUS_SQL = `CASE WHEN purchase.status = 'pending' AND purchase.expires_at <= now()
  THEN 'expired' ELSE purchase.status END`;

interface OrderRow extends Order {
  effectiveStatus: string;
}

@Injectable()
export class OrderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findRecent(userId: string, query: RecentTransactionsQueryDto) {
    const orders = await withEffectiveStatus(
      this.ownOrders(userId).limit(query.limit),
    );
    return {
      data: await this.toTransactions(orders),
      responseMessage: 'Get recent transactions success',
    };
  }

  // Full history behind "Lihat Semua Riwayat": own orders only, newest first.
  async findAll(userId: string, query: TransactionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const orders = this.ownOrders(userId);
    if (query.status) {
      orders.andWhere(`${EFFECTIVE_STATUS_SQL} = :status`, {
        status: query.status,
      });
    }
    const [rows, total] = await Promise.all([
      withEffectiveStatus(
        orders
          .clone()
          .offset((page - 1) * limit)
          .limit(limit),
      ),
      orders.getCount(),
    ]);
    return {
      data: await this.toTransactions(rows),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get transactions success',
    };
  }

  // The buyer's order for the return page; the payment link is included
  // only while the order can still be paid.
  async findDetail(
    userId: string,
    orderId: string,
  ): Promise<OrderDetailResponseDto> {
    const [order] = await withEffectiveStatus(
      this.ownOrders(userId).andWhere('purchase.id = :orderId', { orderId }),
    );
    if (!order) throw new NotFoundException('Order not found');

    const [items, codes] = await Promise.all([
      this.dataSource.query(
        `SELECT item.price_at_purchase AS price, item.discount_amount,
                COALESCE(class.id, product.id, bundle.id) AS item_id,
                COALESCE(class.title, product.title, bundle.title) AS title,
                COALESCE(class_cover.object_key, product_cover.object_key, bundle_cover.object_key) AS image,
                merchant.id AS merchant_id, merchant.store_name AS merchant_name,
                CASE
                  WHEN item.class_id IS NOT NULL THEN ${classKindSql('class.type')}
                  WHEN item.product_id IS NOT NULL THEN 'digital'
                  ELSE 'bundle'
                END AS type
         FROM order_items item
         LEFT JOIN classes class ON class.id = item.class_id
         LEFT JOIN products product ON product.id = item.product_id
         LEFT JOIN bundles bundle ON bundle.id = item.bundle_id
         LEFT JOIN file_assets class_cover ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
         LEFT JOIN file_assets product_cover ON product_cover.id = product.cover_asset_id AND product_cover.deleted_at IS NULL
         LEFT JOIN file_assets bundle_cover ON bundle_cover.id = bundle.cover_asset_id AND bundle_cover.deleted_at IS NULL
         LEFT JOIN merchants merchant
           ON merchant.id = COALESCE(class.merchant_id, product.merchant_id, bundle.merchant_id)
         WHERE item.order_id = $1 AND item.deleted_at IS NULL
         ORDER BY item.created_at, item.id`,
        [order.id],
      ),
      this.dataSource.query(
        `SELECT 'voucher' AS kind, upper(code) AS code FROM coupons WHERE id = $1
         UNION ALL
         SELECT 'discount', upper(code) FROM discount_codes WHERE id = $2`,
        [order.couponId, order.discountCodeId],
      ),
    ]);

    const payable = order.effectiveStatus === OrderStatus.PENDING;
    const total = Number(order.totalAmount);
    const discount = Number(order.discountAmount);
    return {
      id: order.id,
      order_number: order.orderNumber,
      status: order.effectiveStatus,
      created_at: order.created_at,
      expires_at: order.expiresAt,
      paid_at: order.paidAt,
      payment_method: order.paymentMethod,
      items: items.map((item) => ({
        type: item.type,
        item_id: item.item_id,
        title: item.title,
        image_url: assetUrl(item.image),
        merchant_id: item.merchant_id,
        merchant_name: item.merchant_name,
        price: Number(item.price),
        discount_amount: Number(item.discount_amount),
      })),
      codes,
      subtotal: total + discount,
      discount_amount: discount,
      total_amount: total,
      payment_reference: payable ? order.paymentGatewayRef : null,
      payment_url: payable ? order.paymentUrl : null,
    };
  }

  private ownOrders(userId: string): SelectQueryBuilder<Order> {
    return this.dataSource.manager
      .createQueryBuilder(Order, 'purchase')
      .addSelect(EFFECTIVE_STATUS_SQL, 'effective_status')
      .where('purchase.user_id = :userId', { userId })
      .orderBy('purchase.created_at', 'DESC')
      .addOrderBy('purchase.id', 'DESC');
  }

  private async toTransactions(
    orders: OrderRow[],
  ): Promise<TransactionResponseDto[]> {
    if (orders.length === 0) return [];

    // One query for the whole page. Deleted catalog items keep their titles,
    // covers and merchants so history stays readable, as in the detail.
    const items = await this.dataSource.query(
      `SELECT item.order_id, item.price_at_purchase AS price,
              COALESCE(class.id, product.id, bundle.id) AS item_id,
              COALESCE(class.title, product.title, bundle.title) AS title,
              COALESCE(class_cover.object_key, product_cover.object_key, bundle_cover.object_key) AS image,
              merchant.store_name AS merchant_name,
              CASE
                WHEN item.class_id IS NOT NULL THEN ${classKindSql('class.type')}
                WHEN item.product_id IS NOT NULL THEN 'digital'
                ELSE 'bundle'
              END AS type
       FROM order_items item
       LEFT JOIN classes class ON class.id = item.class_id
       LEFT JOIN products product ON product.id = item.product_id
       LEFT JOIN bundles bundle ON bundle.id = item.bundle_id
       LEFT JOIN file_assets class_cover ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
       LEFT JOIN file_assets product_cover ON product_cover.id = product.cover_asset_id AND product_cover.deleted_at IS NULL
       LEFT JOIN file_assets bundle_cover ON bundle_cover.id = bundle.cover_asset_id AND bundle_cover.deleted_at IS NULL
       LEFT JOIN merchants merchant
         ON merchant.id = COALESCE(class.merchant_id, product.merchant_id, bundle.merchant_id)
       WHERE item.order_id = ANY($1::uuid[]) AND item.deleted_at IS NULL
       ORDER BY item.created_at, item.id`,
      [orders.map((order) => order.id)],
    );

    return orders.map((order) => ({
      id: order.id,
      order_number: order.orderNumber,
      created_at: order.created_at,
      status: order.effectiveStatus,
      total_amount: Number(order.totalAmount),
      discount_amount: Number(order.discountAmount),
      items: items
        .filter((item) => item.order_id === order.id)
        .map((item) => ({
          type: item.type,
          item_id: item.item_id,
          title: item.title,
          image_url: assetUrl(item.image),
          merchant_name: item.merchant_name,
          price: Number(item.price),
        })),
    }));
  }
}

async function withEffectiveStatus(
  query: SelectQueryBuilder<Order>,
): Promise<OrderRow[]> {
  const { entities, raw } = await query.getRawAndEntities();
  const statuses = new Map<string, string>(
    raw.map((row) => [row.purchase_id, row.effective_status]),
  );
  return entities.map((order) =>
    Object.assign(order, { effectiveStatus: statuses.get(order.id) }),
  );
}
