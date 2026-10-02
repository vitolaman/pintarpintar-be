import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ItemCoverImage } from './entities/item-cover-image.entity';
import {
  applyCoverInput,
  copyClassCovers,
  findCovers,
  MAX_COVERS,
} from './item-covers';

type Row = Partial<ItemCoverImage>;

// An in-memory item_cover_images table behind the EntityManager calls used.
function fakeManager(rows: Row[] = []) {
  const table = [...rows];
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const manager = {
    table,
    find: jest.fn(async (_entity, { where }) =>
      table
        .filter((row) => matches(row, where))
        .sort((a, b) => a.position - b.position),
    ),
    delete: jest.fn(async (_entity, where) => {
      for (let i = table.length - 1; i >= 0; i--) {
        if (matches(table[i], where)) table.splice(i, 1);
      }
    }),
    insert: jest.fn(async (_entity, values: Row[]) => {
      table.push(...values);
    }),
  };
  return manager;
}
const covers = (manager: ReturnType<typeof fakeManager>, productId = 'p') =>
  manager.table
    .filter((row) => row.productId === productId)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.assetId);
const existing = (...assetIds: string[]): Row[] =>
  assetIds.map((assetId, position) => ({ productId: 'p', assetId, position }));

describe('applyCoverInput', () => {
  const owner = { productId: 'p' };
  let assertAsset: jest.Mock;
  beforeEach(() => {
    assertAsset = jest.fn();
  });
  const apply = (
    manager: ReturnType<typeof fakeManager>,
    input: Parameters<typeof applyCoverInput>[2],
    currentMain: string | null = null,
  ) =>
    applyCoverInput(
      manager as unknown as EntityManager,
      owner,
      input,
      currentMain,
      assertAsset,
    );

  it('replaces the list in order and returns the main cover', async () => {
    const manager = fakeManager(existing('a', 'b'));
    await expect(apply(manager, { cover_asset_ids: ['c', 'a'] })).resolves.toBe(
      'c',
    );
    expect(covers(manager)).toEqual(['c', 'a']);
    expect(assertAsset.mock.calls).toEqual([['c'], ['a']]);
  });

  it('an empty list removes every cover', async () => {
    const manager = fakeManager(existing('a', 'b'));
    await expect(apply(manager, { cover_asset_ids: [] })).resolves.toBeNull();
    expect(covers(manager)).toEqual([]);
  });

  it('the single field moves an id to the front and keeps the rest', async () => {
    const manager = fakeManager(existing('a', 'b'));
    await expect(apply(manager, { cover_asset_id: 'c' })).resolves.toBe('c');
    expect(covers(manager)).toEqual(['c', 'a', 'b']);

    await apply(manager, { cover_asset_id: 'b' });
    expect(covers(manager)).toEqual(['b', 'c', 'a']);
  });

  it(`drops the last cover when the single field would exceed ${MAX_COVERS}`, async () => {
    const manager = fakeManager(existing('a', 'b', 'c', 'd', 'e'));
    await apply(manager, { cover_asset_id: 'f' });
    expect(covers(manager)).toEqual(['f', 'a', 'b', 'c', 'd']);
  });

  it('null removes the main cover so the next becomes main', async () => {
    const manager = fakeManager(existing('a', 'b'));
    await expect(apply(manager, { cover_asset_id: null })).resolves.toBe('b');
    expect(covers(manager)).toEqual(['b']);
    expect(assertAsset).not.toHaveBeenCalled();
  });

  it('uses the item cover_asset_id when the item has no cover rows yet', async () => {
    const manager = fakeManager();
    await apply(manager, { cover_asset_id: 'n' }, 'old');
    expect(covers(manager)).toEqual(['n', 'old']);
  });

  it('rejects both fields at once and changes nothing', async () => {
    const manager = fakeManager(existing('a'));
    await expect(
      apply(manager, { cover_asset_id: 'b', cover_asset_ids: ['c'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(covers(manager)).toEqual(['a']);
  });

  it('leaves covers alone when neither field is sent', async () => {
    const manager = fakeManager(existing('a'));
    await expect(apply(manager, {})).resolves.toBeUndefined();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('stops before writing when an asset fails its check', async () => {
    const manager = fakeManager(existing('a'));
    assertAsset.mockRejectedValueOnce(new BadRequestException('not allowed'));
    await expect(
      apply(manager, { cover_asset_ids: ['bad', 'a'] }),
    ).rejects.toThrow('not allowed');
    expect(covers(manager)).toEqual(['a']);
  });
});

describe('copyClassCovers', () => {
  it('copies covers in order to the new class', async () => {
    const manager = fakeManager([
      { classId: 'src', assetId: 'b', position: 1 },
      { classId: 'src', assetId: 'a', position: 0 },
    ]);
    await copyClassCovers(manager as unknown as EntityManager, 'src', 'copy');
    expect(
      manager.table
        .filter((row) => row.classId === 'copy')
        .map((row) => [row.assetId, row.position]),
    ).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });
});

describe('findCovers', () => {
  it('groups ordered covers by item and gives every item a list', async () => {
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.test';
    const query = jest.fn().mockResolvedValue([
      { owner_id: 'b1', asset_id: 'x', object_key: 'uploads/u/x.png' },
      { owner_id: 'b1', asset_id: 'y', object_key: 'uploads/u/y.png' },
    ]);
    const result = await findCovers({ query } as never, 'bundle', ['b1', 'b2']);
    expect(result.get('b1')).toEqual([
      { asset_id: 'x', url: 'https://cdn.test/uploads/u/x.png' },
      { asset_id: 'y', url: 'https://cdn.test/uploads/u/y.png' },
    ]);
    expect(result.get('b2')).toEqual([]);
    expect(query.mock.calls[0][0]).toContain('cover.bundle_id = ANY');
    expect(query.mock.calls[0][0]).toContain('asset.deleted_at IS NULL');
    delete process.env.ASSET_PUBLIC_BASE_URL;
  });

  it('skips the query for no items', async () => {
    const query = jest.fn();
    await expect(findCovers({ query } as never, 'class', [])).resolves.toEqual(
      new Map(),
    );
    expect(query).not.toHaveBeenCalled();
  });
});
