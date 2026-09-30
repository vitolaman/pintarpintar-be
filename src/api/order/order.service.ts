import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RecentTransactionsQueryDto,
  TransactionResponseDto,
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
    if (orders.length === 0) {
      return { data: [], responseMessage: 'Get recent transactions success' };
    }

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

    const data: TransactionResponseDto[] = orders.map((order) => ({
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

    return { data, responseMessage: 'Get recent transactions success' };
  }
}
