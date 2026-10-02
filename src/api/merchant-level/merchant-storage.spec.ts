import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MerchantStorageLevel } from '../merchant/entities/merchant.entity';
import { assertWithinStorageQuota } from './merchant-storage';

const GB = 1024 ** 3;
const basic = { id: 'merchant-1', level: MerchantStorageLevel.BASIC };

// A transaction manager whose usage query reports `usedBytes` plus the size
// of every extra (same-transaction) upload passed to it.
function transaction(
  usedBytes: number,
  counted = false,
  sizes: Record<string, number> = {},
) {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('pg_advisory_xact_lock')) return [];
    const extra = (params[2] as string[]).reduce(
      (sum, id) => sum + (sizes[id] ?? 0),
      0,
    );
    return [{ used_bytes: String(usedBytes + extra), counted }];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  return { manager, query };
}

describe('assertWithinStorageQuota', () => {
  it('accepts a file that fits the quota', async () => {
    const { manager } = transaction(28 * GB);
    await expect(
      assertWithinStorageQuota(manager, basic, { id: 'a', sizeBytes: GB }),
    ).resolves.toBeUndefined();
  });

  it('rejects a file that would pass the quota, naming level, quota and use', async () => {
    const { manager } = transaction(29.5 * GB);
    await expect(
      assertWithinStorageQuota(manager, basic, { id: 'a', sizeBytes: GB }),
    ).rejects.toThrow(
      new BadRequestException(
        'Storage is full: the Basic level allows 30 GB and 29.5 GB is in use',
      ),
    );
  });

  it('accepts a file the merchant already uses, even at the quota', async () => {
    const { manager } = transaction(30 * GB, true);
    await expect(
      assertWithinStorageQuota(manager, basic, { id: 'a', sizeBytes: GB }),
    ).resolves.toBeUndefined();
  });

  it('allows up to exactly the quota', async () => {
    const { manager } = transaction(29 * GB);
    await expect(
      assertWithinStorageQuota(manager, basic, { id: 'a', sizeBytes: GB }),
    ).resolves.toBeUndefined();
  });

  it('serializes checks per merchant with an advisory lock', async () => {
    const { manager, query } = transaction(0);
    await assertWithinStorageQuota(manager, basic, { id: 'a', sizeBytes: 1 });
    expect(query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['merchant-storage:merchant-1'],
    ]);
  });

  it('counts files accepted earlier in the same transaction', async () => {
    const { manager, query } = transaction(29 * GB, false, { a: 0.8 * GB });
    await assertWithinStorageQuota(manager, basic, {
      id: 'a',
      sizeBytes: 0.8 * GB,
    });
    await expect(
      assertWithinStorageQuota(manager, basic, {
        id: 'b',
        sizeBytes: 0.8 * GB,
      }),
    ).rejects.toThrow('Storage is full');
    expect(query.mock.calls[3][1][2]).toEqual(['a']);
  });

  it('keeps no tally outside a transaction', async () => {
    const query = jest.fn(async (sql: string, params: unknown[] = []) =>
      sql.includes('pg_advisory')
        ? []
        : [{ used_bytes: '0', counted: false, extra: params[2] }],
    );
    const manager = {
      query,
      queryRunner: undefined,
    } as unknown as EntityManager;
    await assertWithinStorageQuota(manager, basic, { id: 'a', sizeBytes: 1 });
    await assertWithinStorageQuota(manager, basic, { id: 'b', sizeBytes: 1 });
    expect(query.mock.calls[3][1][2]).toEqual([]);
  });
});
