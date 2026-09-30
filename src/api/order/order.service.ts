import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RecentTransactionsQueryDto,
  TransactionResponseDto,
  TransactionsQueryDto,
} from './dto/recent-transactions.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findRecent(userId: string, query: RecentTransactionsQueryDto) {
    const orders = await this.dataSource.manager.find(Order, {
      where: { userId },
      order: { created_at: 'DESC', id: 'DESC' },
      take: query.limit,
    });
    return {
      data: await this.toTransactions(orders),
      responseMessage: 'Get recent transactions success',
    };
  }

  // Full history behind "Lihat Semua Riwayat": own orders only, newest first.
  async findAll(userId: string, query: TransactionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [orders, total] = await this.dataSource.manager.findAndCount(Order, {
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      order: { created_at: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: await this.toTransactions(orders),
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
      responseMessage: 'Get transactions success',
    };
  }

  private async toTransactions(
    orders: Order[],
  ): Promise<TransactionResponseDto[]> {
    if (orders.length === 0) return [];

    // Deleted catalog items keep their titles so history stays readable.
    const items = await this.dataSource.query(
      `SELECT item.order_id, item.price_at_purchase AS price,
              COALESCE(class.id, product.id, bundle.id) AS item_id,
              COALESCE(class.title, product.title, bundle.title) AS title,
              CASE
                WHEN item.class_id IS NOT NULL AND class.type = 'live-bootcamp' THEN 'bootcamp'
                WHEN item.class_id IS NOT NULL THEN 'kelas'
                WHEN item.product_id IS NOT NULL THEN 'digital'
                ELSE 'bundle'
              END AS type
       FROM order_items item
       LEFT JOIN classes class ON class.id = item.class_id
       LEFT JOIN products product ON product.id = item.product_id
       LEFT JOIN bundles bundle ON bundle.id = item.bundle_id
       WHERE item.order_id = ANY($1::uuid[]) AND item.deleted_at IS NULL
       ORDER BY item.created_at, item.id`,
      [orders.map((order) => order.id)],
    );

    return orders.map((order) => ({
      id: order.id,
      created_at: order.created_at,
      status: order.status,
      total_amount: Number(order.totalAmount),
      discount_amount: Number(order.discountAmount),
      items: items
        .filter((item) => item.order_id === order.id)
        .map((item) => ({
          type: item.type,
          item_id: item.item_id,
          title: item.title,
          price: Number(item.price),
        })),
    }));
  }
}
