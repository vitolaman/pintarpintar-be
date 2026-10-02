import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  CatalogItemColumns,
  CatalogItemRefDto,
  loadCatalogItems,
  referenceId,
  resolveItemReferences,
} from '~/common/catalog/catalog-item';
import { CartResponseDto } from './dto/cart.dto';
import { CartItem } from './entities/cart-item.entity';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CartService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findCart(userId: string) {
    return this.cartResponse(userId, 'Get cart success');
  }

  /**
   * Adds an item and returns the cart. An item already in the cart leaves
   * it unchanged; `created` tells the controller to answer 200 then.
   */
  async add(userId: string, ref: CatalogItemRefDto) {
    let created: boolean;
    try {
      created = await this.dataSource.transaction(async (manager) => {
        const [columns] = await resolveItemReferences(manager, [ref]);
        const item = (await loadCatalogItems(manager, [columns])).get(ref.id);
        if (!item || !item.is_available) {
          throw new BadRequestException('Item is not available');
        }
        if (await this.isOwned(manager, userId, columns)) {
          throw new BadRequestException('You already own this item');
        }
        if (await manager.findOneBy(CartItem, { userId, ...columns })) {
          return false;
        }
        await manager.save(
          CartItem,
          manager.create(CartItem, { userId, ...columns }),
        );
        return true;
      });
    } catch (error) {
      // A concurrent add of the same item loses on the unique index; the
      // item is in the cart either way.
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code: string }).code === UNIQUE_VIOLATION
      ) {
        created = false;
      } else {
        throw error;
      }
    }

    const cart = await this.cartResponse(
      userId,
      created ? 'Add to cart success' : 'Item already in cart',
    );
    return { created, ...cart };
  }

  // `id` is the cart entry id or the id of the item in the cart.
  async remove(userId: string, id: string) {
    const result = await this.dataSource.manager
      .createQueryBuilder()
      .delete()
      .from(CartItem)
      .where('user_id = :userId', { userId })
      .andWhere(
        '(id = :id OR class_id = :id OR product_id = :id OR bundle_id = :id)',
        { id },
      )
      .execute();
    if (!result.affected) throw new NotFoundException('Cart item not found');
    return this.cartResponse(userId, 'Remove cart item success');
  }

  async clear(userId: string) {
    await this.dataSource.manager.delete(CartItem, { userId });
    return this.cartResponse(userId, 'Clear cart success');
  }

  private async cartResponse(userId: string, responseMessage: string) {
    return { data: await this.buildCart(userId), responseMessage };
  }

  private async buildCart(userId: string): Promise<CartResponseDto> {
    const entries = await this.dataSource.manager.find(CartItem, {
      where: { userId },
      order: { addedAt: 'DESC', id: 'DESC' },
    });
    const items = await loadCatalogItems(this.dataSource.manager, entries);
    const lines = entries.map((entry) => ({
      id: entry.id,
      added_at: entry.addedAt,
      item: items.get(referenceId(entry)),
    }));

    return {
      items: lines,
      subtotal: lines
        .filter((line) => line.item?.is_available)
        .reduce((total, line) => total + line.item.price, 0),
      item_count: lines.length,
    };
  }

  // Owned: active class enrollment, unexpired product access, or a paid bundle.
  private async isOwned(
    manager: EntityManager,
    userId: string,
    columns: CatalogItemColumns,
  ): Promise<boolean> {
    const [row] = await manager.query(
      `SELECT CASE
         WHEN $2::uuid IS NOT NULL THEN EXISTS (
           SELECT 1 FROM enrollments
           WHERE user_id = $1 AND class_id = $2 AND deleted_at IS NULL)
         WHEN $3::uuid IS NOT NULL THEN EXISTS (
           SELECT 1 FROM user_access
           WHERE user_id = $1 AND product_id = $3 AND deleted_at IS NULL
             AND (expires_at IS NULL OR expires_at > now()))
         ELSE EXISTS (
           SELECT 1 FROM order_items item
           INNER JOIN orders purchase ON purchase.id = item.order_id
           WHERE purchase.user_id = $1 AND item.bundle_id = $4
             AND purchase.status = 'paid'
             AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL)
       END AS owned`,
      [userId, columns.classId, columns.productId, columns.bundleId],
    );
    return row.owned;
  }
}
