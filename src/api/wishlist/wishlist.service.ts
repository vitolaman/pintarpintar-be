import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CatalogItemRefDto,
  loadCatalogItems,
  referenceId,
  toReferenceColumns,
} from '~/common/catalog/catalog-item';
import { WishlistEntryResponseDto, WishlistQueryDto } from './dto/wishlist.dto';
import { WishlistItem } from './entities/wishlist-item.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';

@Injectable()
export class WishlistService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(userId: string, query: WishlistQueryDto) {
    const { page, limit } = query;
    const [entries, total] = await this.dataSource.manager.findAndCount(
      WishlistItem,
      {
        where: { userId },
        order: { addedAt: 'DESC', id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: await this.toResponses(entries),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get wishlist success',
    };
  }

  async add(userId: string, ref: CatalogItemRefDto) {
    const columns = toReferenceColumns(ref);
    const [entry, created] = await this.dataSource.transaction(
      async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `wishlist:${userId}:${ref.id}`,
        ]);
        const existing = await manager.findOneBy(WishlistItem, {
          userId,
          ...columns,
        });
        if (existing) return [existing, false] as const;

        const item = (await loadCatalogItems(manager, [columns])).get(ref.id);
        if (!item || item.type !== ref.type || !item.is_available) {
          throw new BadRequestException('Item is not available');
        }
        const saved = await manager.save(
          WishlistItem,
          manager.create(WishlistItem, { userId, ...columns }),
        );
        return [saved, true] as const;
      },
    );

    const [response] = await this.toResponses([entry]);
    return {
      data: response,
      responseMessage: created
        ? 'Add to wishlist success'
        : 'Item already in wishlist',
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.dataSource.manager.delete(WishlistItem, {
      id,
      userId,
    });
    if (!result.affected)
      throw new NotFoundException('Wishlist item not found');
  }

  private async toResponses(
    entries: WishlistItem[],
  ): Promise<WishlistEntryResponseDto[]> {
    const items = await loadCatalogItems(this.dataSource.manager, entries);
    return entries.map((entry) => ({
      id: entry.id,
      added_at: entry.addedAt,
      item: items.get(referenceId(entry)),
    }));
  }
}
