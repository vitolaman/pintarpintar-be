import { EntityManager } from 'typeorm';
import { findOwnedItemIds, loadCatalogItems } from './catalog-item';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002';
const BUNDLE_ID = '10000000-0000-4000-8000-000000000003';

const catalogRow = (override: Record<string, unknown> = {}) => ({
  type: 'kelas',
  id: CLASS_ID,
  title: 'Belajar AutoCAD dari Nol',
  image: null,
  price: '299000',
  original_price: '350000',
  merchant_id: 'merchant-id',
  merchant_name: 'Akademi Teknik Budi',
  merchant_slug: 'akademi-teknik-budi',
  is_available: true,
  merchant_active: true,
  ...override,
});

describe('loadCatalogItems', () => {
  const query = jest.fn();
  const manager = { query } as unknown as EntityManager;
  const ref = { classId: CLASS_ID, productId: null, bundleId: null };

  beforeEach(() => query.mockReset());

  it('reports a published item of an active merchant as available', async () => {
    query.mockResolvedValueOnce([catalogRow()]);

    const item = (await loadCatalogItems(manager, [ref])).get(CLASS_ID);

    expect(item).toMatchObject({ price: 299000, is_available: true });
  });

  it('gives the public cover URL and no object key', async () => {
    const baseUrl = process.env.ASSET_PUBLIC_BASE_URL;
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    try {
      query.mockResolvedValueOnce([
        catalogRow({ image: 'uploads/cover kelas.png' }),
        catalogRow({ id: PRODUCT_ID, type: 'digital', image: null }),
      ]);

      const items = await loadCatalogItems(manager, [
        ref,
        { classId: null, productId: PRODUCT_ID, bundleId: null },
      ]);

      expect(items.get(CLASS_ID)).toEqual(
        expect.objectContaining({
          image_url: 'https://cdn.example.com/uploads/cover%20kelas.png',
        }),
      );
      expect(items.get(CLASS_ID)).not.toHaveProperty('image');
      expect(items.get(PRODUCT_ID).image_url).toBeNull();
    } finally {
      process.env.ASSET_PUBLIC_BASE_URL = baseUrl;
      if (baseUrl === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    }
  });

  it('maps the stored class type to the kelas or bootcamp kind in SQL', async () => {
    query.mockResolvedValueOnce([catalogRow({ type: 'bootcamp' })]);

    const item = (await loadCatalogItems(manager, [ref])).get(CLASS_ID);

    expect(item.type).toBe('bootcamp');
    expect(query.mock.calls[0][0]).toContain(
      "(CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END) AS type",
    );
  });

  it.each([
    ['an inactive or deleted merchant', { merchant_active: false }],
    ['an unpublished or deleted item', { is_available: false }],
  ])('reports an item of %s as unavailable', async (_case, override) => {
    query.mockResolvedValueOnce([catalogRow(override)]);

    const item = (await loadCatalogItems(manager, [ref])).get(CLASS_ID);

    expect(item.is_available).toBe(false);
  });
});

describe('findOwnedItemIds', () => {
  const query = jest.fn();
  const manager = { query } as unknown as EntityManager;

  beforeEach(() => query.mockReset());

  it('queries nothing for an empty selection', async () => {
    expect(await findOwnedItemIds(manager, 'user-id', [])).toEqual(new Set());
    expect(query).not.toHaveBeenCalled();
  });

  it('passes the ids of each reference type and returns the owned ids', async () => {
    query.mockResolvedValueOnce([{ id: CLASS_ID }, { id: BUNDLE_ID }]);

    const owned = await findOwnedItemIds(manager, 'user-id', [
      { classId: CLASS_ID, productId: null, bundleId: null },
      { classId: null, productId: PRODUCT_ID, bundleId: null },
      { classId: null, productId: null, bundleId: BUNDLE_ID },
    ]);

    expect(owned).toEqual(new Set([CLASS_ID, BUNDLE_ID]));
    expect(query.mock.calls[0][1]).toEqual([
      'user-id',
      [CLASS_ID],
      [PRODUCT_ID],
      [BUNDLE_ID],
    ]);
  });
});
