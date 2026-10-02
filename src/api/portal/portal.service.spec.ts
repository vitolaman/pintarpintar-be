import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { PortalItemQueryDto } from './dto/portal-item-query.dto';
import {
  meetingPlatformFor,
  parseProgress,
  PortalService,
} from './portal.service';

const baseRow = {
  image: null,
  acquired_at: new Date('2026-09-20T02:00:00.000Z'),
  merchant_id: 'merchant-id',
  raw_progress: null,
  merchant_name: 'Akademi Teknik Nusantara',
  merchant_slug: 'akademi-teknik-nusantara',
  merchant_avatar_object_key: null,
  module_count: null,
  assignment_count: null,
  has_certificate: null,
  meeting_title: null,
  meeting_date: null,
  meeting_time: null,
  meeting_live_url: null,
};

describe('PortalItemQueryDto', () => {
  const errorsFor = async (query: Record<string, string>) =>
    validate(plainToInstance(PortalItemQueryDto, query));

  it('defaults to every tab, the first page, and 10 items', async () => {
    const query = plainToInstance(PortalItemQueryDto, {});

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ type: 'all', page: 1, limit: 10 });
  });

  it('rejects an unknown tab', async () => {
    expect(await errorsFor({ type: 'sertifikasi' })).not.toHaveLength(0);
  });

  it.each([
    [{ page: '0' }, { page: 1 }],
    [{ limit: '0' }, { limit: 1 }],
    [{ limit: '101' }, { limit: 100 }],
    [{ page: 'abc' }, { page: 1 }],
  ])('clamps %j', async (input, expected) => {
    const query = plainToInstance(PortalItemQueryDto, input);
    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject(expected);
  });

  it('accepts every frontend tab value', async () => {
    for (const type of [
      'all',
      'kelas-video',
      'live-bootcamp',
      'produk-digital',
    ]) {
      expect(await errorsFor({ type })).toHaveLength(0);
    }
  });

  it('treats a blank tab and search as every tab and no search', async () => {
    const query = plainToInstance(PortalItemQueryDto, {
      type: ' ',
      search: '',
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ type: 'all', search: undefined });
  });

  it('matches the tab ignoring case and trims the search', async () => {
    const query = plainToInstance(PortalItemQueryDto, {
      type: ' Live-Bootcamp ',
      search: '  autocad ',
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ type: 'live-bootcamp', search: 'autocad' });
  });
});

describe('parseProgress', () => {
  it.each([
    ['70', 70],
    ['70%', 70],
    ['70.6', 71],
    [' 45 ', 45],
    ['150', 100],
    ['selesai', 0],
    ['', 0],
    [null, 0],
  ])('parses %j as %i', (raw, expected) => {
    expect(parseProgress(raw)).toBe(expected);
  });
});

describe('meetingPlatformFor', () => {
  it.each([
    ['https://zoom.us/j/123', 'Zoom'],
    ['https://us02web.zoom.us/j/123', 'Zoom'],
    ['https://meet.google.com/abc-defg-hij', 'Google Meet'],
    ['https://teams.microsoft.com/l/meetup-join/1', 'Microsoft Teams'],
    ['https://notzoom.us.example.com/j/1', null],
    ['https://example.com/live', null],
    ['not a url', null],
    [null, null],
  ])('maps %j to %j', (liveUrl, expected) => {
    expect(meetingPlatformFor(liveUrl)).toBe(expected);
  });
});

describe('PortalService', () => {
  let query: jest.Mock;
  let service: PortalService;

  beforeEach(() => {
    query = jest.fn();
    service = new PortalService({ query } as unknown as DataSource);
  });

  const request = (overrides: Partial<PortalItemQueryDto> = {}) =>
    Object.assign(new PortalItemQueryDto(), overrides);

  it('returns an empty page without running the page query', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]);

    await expect(service.findItems('user-id', request())).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPage: 0 },
      responseMessage: 'Get portal items success',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('scopes to the caller, the tab, the escaped search, and the page window', async () => {
    query.mockResolvedValueOnce([{ total: 25 }]).mockResolvedValueOnce([]);

    const result = await service.findItems(
      'user-id',
      request({
        type: 'live-bootcamp',
        search: '50%_off\\',
        page: 2,
        limit: 20,
      }),
    );

    const [countSql, countParams] = query.mock.calls[0];
    const [pageSql, pageParams] = query.mock.calls[1];

    expect(countSql).toContain('enrollment.user_id = $1');
    expect(countSql).toContain('access.user_id = $1');
    expect(countParams).toEqual([
      'user-id',
      'live-bootcamp',
      '50\\%\\_off\\\\',
    ]);
    expect(pageSql).toContain(
      'ORDER BY owned.acquired_at DESC, owned.item_id DESC',
    );
    expect(pageParams).toEqual([...countParams, 20, 20]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 25,
      totalPage: 2,
    });
  });

  it('maps each item type to its card fields', async () => {
    query.mockResolvedValueOnce([{ total: 3 }]).mockResolvedValueOnce([
      {
        ...baseRow,
        item_id: 'video-class-id',
        item_type: 'kelas-video',
        title: 'Belajar AutoCAD dari Nol',
        raw_progress: '70',
        module_count: '12',
        assignment_count: '2',
        has_certificate: false,
      },
      {
        ...baseRow,
        item_id: 'bootcamp-id',
        item_type: 'live-bootcamp',
        title: 'PLC Programming Bootcamp',
        raw_progress: '40',
        has_certificate: true,
        meeting_title: 'Sesi 3',
        meeting_date: '2026-10-02',
        meeting_time: '19:00',
        meeting_live_url: 'https://zoom.us/j/123',
      },
      {
        ...baseRow,
        item_id: 'product-id',
        item_type: 'produk-digital',
        title: 'Template RAB Excel',
        image: 'products/covers/rab.png',
      },
    ]);

    const { data } = await service.findItems('user-id', request());

    expect(data[0]).toMatchObject({
      id: 'video-class-id',
      type: 'kelas-video',
      image: null,
      progress: 70,
      module_count: 12,
      assignment_count: 2,
      has_certificate: false,
      next_meeting: null,
      merchant_name: 'Akademi Teknik Nusantara',
      merchant_slug: 'akademi-teknik-nusantara',
    });
    expect(data[1]).toMatchObject({
      type: 'live-bootcamp',
      progress: null,
      module_count: null,
      has_certificate: true,
      next_meeting: {
        title: 'Sesi 3',
        date: '2026-10-02',
        time: '19:00',
        live_url: 'https://zoom.us/j/123',
        platform: 'Zoom',
      },
    });
    expect(data[2]).toMatchObject({
      type: 'produk-digital',
      image: 'products/covers/rab.png',
      progress: null,
      has_certificate: null,
      next_meeting: null,
    });
  });

  it('adds the cover and merchant avatar URLs', async () => {
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    try {
      query.mockResolvedValueOnce([{ total: 2 }]).mockResolvedValueOnce([
        {
          ...baseRow,
          item_id: 'product-id',
          item_type: 'produk-digital',
          title: 'Template RAB Excel',
          image: 'products/covers/rab.png',
          merchant_avatar_object_key: 'merchants/logo.png',
        },
        {
          ...baseRow,
          item_id: 'class-id',
          item_type: 'kelas-video',
          title: 'AutoCAD',
        },
      ]);

      const { data } = await service.findItems('user-id', request());

      expect(data[0]).toMatchObject({
        image: 'products/covers/rab.png',
        image_url: 'https://cdn.example.com/products/covers/rab.png',
        merchant_avatar_object_key: 'merchants/logo.png',
        merchant_avatar_url: 'https://cdn.example.com/merchants/logo.png',
      });
      expect(data[1]).toMatchObject({
        image_url: null,
        merchant_avatar_url: null,
      });
    } finally {
      delete process.env.ASSET_PUBLIC_BASE_URL;
    }
  });
});
