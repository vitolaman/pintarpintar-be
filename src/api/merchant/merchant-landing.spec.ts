import { BadRequestException } from '@nestjs/common';
import {
  assertLayoutItemsOwned,
  normalizeLandingLayout,
} from './merchant-landing';

const ITEM = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('normalizeLandingLayout', () => {
  it('accepts known sections and lower-cases item ids', () => {
    expect(
      normalizeLandingLayout({
        section_order: ['bundles', 'best_seller'],
        item_order: { best_seller: [ITEM.toUpperCase()] },
      }),
    ).toEqual({
      section_order: ['bundles', 'best_seller'],
      item_order: { best_seller: [ITEM] },
    });
  });

  it.each([
    ['a non-object', 'layout'],
    ['an unknown section', { section_order: ['sidebar'] }],
    ['a repeated section', { section_order: ['kelas', 'kelas'] }],
    [
      'an unknown item section',
      { section_order: [], item_order: { hero: [ITEM] } },
    ],
    [
      'a non-uuid item',
      { section_order: [], item_order: { kelas: ['not-an-id'] } },
    ],
    [
      'a repeated item',
      { section_order: [], item_order: { kelas: [ITEM, ITEM] } },
    ],
  ])('rejects %s', (_label, input) => {
    expect(() => normalizeLandingLayout(input)).toThrow(BadRequestException);
  });
});

describe('assertLayoutItemsOwned', () => {
  it('rejects items that are not the merchant items of that section', async () => {
    const manager = { query: jest.fn().mockResolvedValue([{ missing: 1 }]) };

    await expect(
      assertLayoutItemsOwned(manager as never, 'merchant-id', {
        section_order: [],
        item_order: { digital: [ITEM] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.query.mock.calls[0][1]).toEqual([
      'merchant-id',
      JSON.stringify([{ section: 'digital', id: ITEM }]),
    ]);
  });

  it('skips the lookup when no items are ordered', async () => {
    const manager = { query: jest.fn() };

    await assertLayoutItemsOwned(manager as never, 'merchant-id', {
      section_order: ['kelas'],
      item_order: {},
    });
    expect(manager.query).not.toHaveBeenCalled();
  });
});
