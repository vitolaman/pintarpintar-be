import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const classId = '30000000-0000-4000-8000-000000000001';
  let dataSource: { query: jest.Mock };
  let service: CatalogService;

  const cardRow = {
    id: classId,
    type: 'bootcamp',
    title: 'Revit Architecture Bootcamp',
    image: null,
    category: null,
    level: null,
    price: '750000',
    list_price: '1000000',
    created_at: new Date('2026-09-20T00:00:00.000Z'),
    merchant_id: 'merchant-id',
    description: 'Belajar Revit dari nol.',
    rating: '4.66',
    review_count: '3',
    students_count: '12',
    merchant_name: 'Sari Digital Studio',
    merchant_slug: 'sari-digital-studio',
    merchant_avatar_object_key: null,
  };

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    service = new CatalogService(dataSource as unknown as DataSource);
  });

  it('maps a card with the current selling price and discount percent', async () => {
    dataSource.query.mockResolvedValue([
      cardRow,
      {
        ...cardRow,
        id: 'digital-id',
        type: 'digital',
        price: '50000',
        list_price: '50000',
      },
    ]);

    const cards = await service.findCards(
      { types: ['bootcamp'] },
      'terbaru',
      6,
    );

    expect(cards[0]).toMatchObject({
      id: classId,
      type: 'bootcamp',
      price: 750000,
      original_price: 1000000,
      discount_percent: 25,
      rating: 4.7,
      review_count: 3,
      students_count: 12,
      merchant: { id: 'merchant-id', name: 'Sari Digital Studio' },
    });
    expect(cards[1].discount_percent).toBeNull();
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at DESC, cards.id');
    expect(params).toEqual([
      ['bootcamp'],
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      false,
      6,
      0,
    ]);
  });

  it('escapes LIKE wildcards and pages the catalog list', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ total: 25 }])
      .mockResolvedValueOnce([cardRow]);

    const response = await service.findItems({
      type: ['kelas', 'bootcamp'],
      search: '50%_off',
      sort: 'termurah',
      page: 2,
      limit: 10,
    } as never);

    expect(response.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPage: 3,
    });
    const [sql, params] = dataSource.query.mock.calls[1];
    expect(sql).toContain('ORDER BY price ASC, cards.id');
    expect(params.slice(0, 2)).toEqual([['kelas', 'bootcamp'], '50\\%\\_off']);
    expect(params.slice(8)).toEqual([false, 10, 10]);
  });

  it('filters by merchant and file type and maps mentor and file fields', async () => {
    const merchantId = '20000000-0000-4000-8000-000000000001';
    dataSource.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          ...cardRow,
          type: 'digital',
          mentor_id: null,
          mentor_name: 'Budi Santoso',
          mentor_avatar_object_key: null,
          file_format: 'PDF, DWG',
          file_size: '15728640',
        },
      ]);

    const response = await service.findItems({
      merchant_id: merchantId,
      file_format: ['pdf', 'dwg'],
      page: 1,
      limit: 12,
      sort: 'terbaru',
    } as never);

    expect(response.data[0]).toMatchObject({
      mentor: { id: null, name: 'Budi Santoso', avatar_url: null },
      file_format: 'PDF, DWG',
      file_size: 15728640,
      image_url: null,
    });
    expect(dataSource.query.mock.calls[0][1].slice(6)).toEqual([
      merchantId,
      ['pdf', 'dwg'],
      false,
    ]);
  });

  it('skips the page query when nothing matches', async () => {
    dataSource.query.mockResolvedValueOnce([{ total: 0 }]);

    const response = await service.findItems({
      page: 1,
      limit: 12,
      sort: 'terbaru',
    } as never);

    expect(response.data).toEqual([]);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('returns class detail without video, file, or meeting links', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT mentor_user.name, profile.headline'))
        return Promise.resolve([]);
      if (sql.includes('SELECT id, title, description FROM chapters'))
        return Promise.resolve([
          { id: 'chapter-id', title: 'Dasar', description: null },
        ]);
      if (sql.includes('FROM videos video'))
        return Promise.resolve([
          {
            id: 'video-id',
            chapter_id: 'chapter-id',
            title: 'Intro',
            duration: '10:00',
          },
        ]);
      if (sql.includes('FROM file_resources'))
        return Promise.resolve([
          {
            id: 'file-id',
            chapter_id: 'chapter-id',
            name: 'Modul',
            type: 'pdf',
            size: '1 MB',
          },
        ]);
      if (sql.includes('FROM meetings'))
        return Promise.resolve([
          {
            id: 'meeting-id',
            title: 'Sesi 1',
            date: '2026-10-01',
            time: '19:00',
            status: 'scheduled',
          },
        ]);
      return Promise.resolve([cardRow]);
    });

    const { data } = await service.findClass(classId);

    expect(data.chapters).toEqual([
      {
        id: 'chapter-id',
        title: 'Dasar',
        description: null,
        videos: [{ id: 'video-id', title: 'Intro', duration: '10:00' }],
        files: [{ id: 'file-id', name: 'Modul', type: 'pdf', size: '1 MB' }],
      },
    ]);
    expect(data.meetings).toHaveLength(1);
    const detailSql = dataSource.query.mock.calls
      .map(([sql]) => sql)
      .join('\n');
    expect(detailSql).not.toMatch(/"?(videoUrl|fileUrl|liveUrl)"?/);
  });

  it('reads a class by id including unlisted (archived) classes', async () => {
    dataSource.query.mockResolvedValue([]);

    await expect(service.findClass(classId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dataSource.query.mock.calls[0][1]).toEqual([
      ['kelas', 'bootcamp'],
      null,
      null,
      null,
      false,
      classId,
      null,
      null,
      true,
    ]);
    const [sql] = dataSource.query.mock.calls[0];
    expect(sql).toContain(
      "(class.status = 'published' OR ($9::boolean AND class.status = 'archived'))",
    );
  });

  it('passes the signed-in visitor to the ownership check', async () => {
    dataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('AS owned')) return [{ owned: true }];
      if (sql.includes('learning_outcomes FROM classes')) {
        return [
          {
            duration: '8 minggu',
            prerequisites: 'Laptop\n\n Dasar AutoCAD ',
            learning_outcomes: ['Membuat denah'],
          },
        ];
      }
      if (sql.includes('FROM ('))
        return [{ ...cardRow, type: 'kelas', id: classId }];
      return [];
    });

    const { data } = await service.findClass(classId, 'viewer-id');

    expect(data).toMatchObject({
      duration: '8 minggu',
      prerequisites: 'Laptop\n\n Dasar AutoCAD ',
      requirements: ['Laptop', 'Dasar AutoCAD'],
      learning_outcomes: ['Membuat denah'],
    });

    const ownershipCall = dataSource.query.mock.calls.find(([sql]) =>
      String(sql).includes('AS owned'),
    );
    expect(ownershipCall[1]).toEqual([classId, 'viewer-id']);
    expect(data.is_owned).toBe(true);
  });

  it('treats anonymous visitors as not owning', async () => {
    dataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('AS owned')) return [{ owned: false }];
      if (sql.includes('FROM ('))
        return [{ ...cardRow, type: 'digital', id: classId }];
      return [];
    });

    const { data } = await service.findDigitalProduct(classId);

    const ownershipCall = dataSource.query.mock.calls.find(([sql]) =>
      String(sql).includes('AS owned'),
    );
    expect(ownershipCall[1]).toEqual([classId, null]);
    expect(data.is_owned).toBe(false);
  });

  it('searches titles, merchant names, category names and file formats', async () => {
    dataSource.query.mockResolvedValueOnce([{ total: 0 }]);

    await service.findItems({ search: 'dwg', page: 1, limit: 12 } as never);

    const [sql] = dataSource.query.mock.calls[0];
    expect(sql).toContain("merchant.store_name ILIKE '%' || $2 || '%'");
    expect(sql).toContain("category.name ILIKE '%' || $2 || '%'");
    expect(sql).toContain('file.file_format ILIKE $2');
  });

  it('filters by category slug or name', async () => {
    dataSource.query.mockResolvedValueOnce([{ total: 0 }]);

    await service.findItems({
      category: 'Template Canva',
      page: 1,
      limit: 12,
    } as never);

    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain(
      'category.slug = $4 OR lower(category.name) = lower($4)',
    );
    expect(params[3]).toBe('Template Canva');
  });

  it('nests categories under their parent', async () => {
    (dataSource as unknown as { manager: unknown }).manager = {
      find: jest.fn(async () => [
        {
          id: 'design',
          name: 'Desain Grafis',
          slug: 'desain-grafis',
          parentId: null,
        },
        { id: 'excel', name: 'Excel', slug: 'excel', parentId: null },
        { id: 'figma', name: 'Figma', slug: 'figma', parentId: 'design' },
      ]),
    };

    const { data } = await service.findCategories();

    expect(data.map((node) => node.slug)).toEqual(['desain-grafis', 'excel']);
    expect(data[0].children).toEqual([
      { id: 'figma', name: 'Figma', slug: 'figma', children: [] },
    ]);
  });
});
