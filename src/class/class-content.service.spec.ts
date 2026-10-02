import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassAccessService } from './class-access.service';
import { Class } from './entities/class.entity';
import { Merchant } from '../api/merchant/entities/merchant.entity';
import { ClassContentService } from './class-content.service';
import { DEFAULT_TUTOR_PERMISSIONS } from './class-permissions';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { AddResourcesDto } from './dto/resource.dto';
import { CreateVideoDto } from './dto/video.dto';
import { Chapter } from './entities/chapter.entity';
import { FileResource } from './entities/file-resource.entity';
import { Video } from './entities/video.entity';

describe('ClassContentService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const chapterId = '50000000-0000-4000-8000-000000000001';
  const assetId = '40000000-0000-4000-8000-000000000001';
  let access: Record<string, unknown> | null;
  let manager: Record<string, jest.Mock>;
  let maxOrder: number | null;
  let liveVideoIds: string[];
  let service: ClassContentService;
  let progress: { recomputeClass: jest.Mock };

  beforeEach(() => {
    access = { is_owner: true };
    maxOrder = null;
    liveVideoIds = [];
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('used_bytes')) {
        return [{ used_bytes: '0', counted: false }];
      }
      if (sql.includes('AS is_owner')) return access ? [access] : [];
      if (sql.includes('FROM videos WHERE chapter_id')) {
        return liveVideoIds.map((id) => ({ id }));
      }
      return [];
    });
    const builder = {
      select: jest.fn(() => builder),
      where: jest.fn(() => builder),
      getRawOne: jest.fn(async () => ({ max: maxOrder })),
    };
    manager = {
      query,
      findOne: jest.fn(async (entity) =>
        entity === Chapter ? { id: chapterId, class_id: classId } : null,
      ),
      findOneBy: jest.fn(),
      find: jest.fn(async () => []),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (...args: unknown[]) => args[args.length - 1]),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => builder),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    progress = { recomputeClass: jest.fn() };
    service = new ClassContentService(
      dataSource as never,
      new ClassAccessService(dataSource as never),
      progress as never,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('appends a new chapter after the last one', async () => {
    maxOrder = 2;

    const response = await service.createChapter(userId, classId, {
      title: 'Bab 4',
    });

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT id FROM classes WHERE id = $1 FOR UPDATE',
      [classId],
    );
    expect(response.data).toMatchObject({ order: 3, videos: [], files: [] });
  });

  it('forbids a moderator from adding chapters', async () => {
    access = {
      is_owner: false,
      role: 'moderator',
      permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
    };

    await expect(
      service.createChapter(userId, classId, { title: 'Bab 1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('returns 404 for a chapter of another class', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.createVideo(userId, classId, chapterId, {
        title: 'Intro',
        youtubeUrl: 'https://youtu.be/x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recomputes learner progress when videos change', async () => {
    await service.createVideo(userId, classId, chapterId, {
      title: 'Intro',
      youtubeUrl: 'https://youtu.be/x',
    });
    await service.deleteChapter(userId, classId, chapterId);
    manager.findOne.mockImplementation(async (entity) =>
      entity === Chapter
        ? { id: chapterId, class_id: classId }
        : { id: 'video-id', chapter_id: chapterId },
    );
    await service.deleteVideo(userId, classId, chapterId, 'video-id');

    expect(progress.recomputeClass).toHaveBeenCalledTimes(3);
    expect(progress.recomputeClass).toHaveBeenCalledWith(manager, classId);
  });

  it('leaves progress alone when only a resource is deleted', async () => {
    manager.findOne.mockImplementation(async (entity) =>
      entity === Chapter
        ? { id: chapterId, class_id: classId }
        : { id: 'resource-id', chapter_id: chapterId },
    );

    await service.deleteResource(userId, classId, chapterId, 'resource-id');

    expect(progress.recomputeClass).not.toHaveBeenCalled();
  });

  it('places a new video last in the chapter', async () => {
    maxOrder = 4;

    const response = await service.createVideo(userId, classId, chapterId, {
      title: 'Intro',
      youtubeUrl: 'https://www.youtube.com/embed/abc',
    });

    expect(response.data).toMatchObject({ order: 5, chapter_id: chapterId });
  });

  it('soft-deletes a chapter together with its videos and resources', async () => {
    await service.deleteChapter(userId, classId, chapterId);

    const targets = manager.update.mock.calls.map(([entity]) => entity);
    expect(targets).toEqual([Video, FileResource, Chapter]);
    for (const [, , values] of manager.update.mock.calls) {
      expect(values).toMatchObject({ deleted_by: userId });
    }
  });

  it('rejects a file resource with an upload the caller did not register', async () => {
    manager.findOneBy.mockResolvedValue({
      id: assetId,
      uploadedByUserId: 'someone-else',
      status: 'active',
      visibility: 'private',
    });

    await expect(
      service.addResources(userId, classId, chapterId, {
        resources: [{ type: 'pdf', name: 'Modul', asset_id: assetId }],
      } as AddResourcesDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('stores a private file resource with its size and no public URL', async () => {
    // The class's merchant decides the per-file limit (Basic: 1 GB).
    manager.findOneBy.mockImplementation(async (entity) => {
      if (entity === Class) return { id: classId, merchant_id: 'merchant-id' };
      if (entity === Merchant)
        return { id: 'merchant-id', storageLevel: 'basic' };
      return {
        id: assetId,
        uploadedByUserId: userId,
        status: 'active',
        visibility: 'private',
        originalFilename: 'modul.pdf',
        mimeType: 'application/pdf',
        sizeBytes: '2048',
      };
    });

    await service.addResources(userId, classId, chapterId, {
      resources: [
        { type: 'pdf', name: 'Modul', asset_id: assetId },
        { type: 'link', name: 'Referensi', url: 'https://example.com' },
      ],
    } as AddResourcesDto);

    expect(manager.save).toHaveBeenCalledWith(FileResource, [
      expect.objectContaining({
        asset_id: assetId,
        url: null,
        size: '2048',
        order: 0,
      }),
      expect.objectContaining({
        asset_id: null,
        url: 'https://example.com',
        order: 1,
      }),
    ]);
  });

  it('rejects an order list that omits a video and changes nothing', async () => {
    liveVideoIds = ['video-a', 'video-b'];

    await expect(
      service.reorderChapterItems(userId, classId, chapterId, {
        video_ids: ['video-b'],
        resource_ids: [],
      }),
    ).rejects.toThrow('video_ids must list every item of the chapter');
    const updates = manager.query.mock.calls.filter(([sql]) =>
      String(sql).includes('UPDATE'),
    );
    expect(updates).toEqual([]);
  });

  it('rewrites positions from a complete order list', async () => {
    liveVideoIds = ['video-a', 'video-b'];

    await service.reorderChapterItems(userId, classId, chapterId, {
      video_ids: ['video-b', 'video-a'],
      resource_ids: [],
    });

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE videos item SET "order"'),
      [['video-b', 'video-a']],
    );
  });

  it('refuses a URL change on a file resource', async () => {
    manager.findOne.mockImplementation(async (entity) =>
      entity === Chapter
        ? { id: chapterId, class_id: classId }
        : { id: 'resource-id', chapter_id: chapterId, type: 'pdf' },
    );

    await expect(
      service.updateResource(userId, classId, chapterId, 'resource-id', {
        url: 'https://example.com/other.pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('video sources', () => {
    const assetId = '50000000-0000-4000-8000-000000000001';
    const upload = (overrides: Record<string, unknown> = {}) => ({
      id: assetId,
      uploadedByUserId: userId,
      status: 'active',
      visibility: 'private',
      originalFilename: 'materi.mp4',
      mimeType: 'video/mp4',
      sizeBytes: String(500 * 1024 * 1024),
      ...overrides,
    });
    const owned = (asset: Record<string, unknown>) =>
      manager.findOneBy.mockImplementation(async (entity) => {
        if (entity === Class)
          return { id: classId, merchant_id: 'merchant-id' };
        if (entity === Merchant) {
          return { id: 'merchant-id', storageLevel: 'basic' };
        }
        return asset;
      });
    const create = (body: Record<string, unknown>) =>
      service.createVideo(userId, classId, chapterId, {
        title: 'Materi',
        ...body,
      } as CreateVideoDto);

    it('stores an uploaded file video without a URL', async () => {
      owned(upload());
      const response = await create({ source: 'file', asset_id: assetId });
      expect(response.data).toMatchObject({
        source: 'file',
        asset_id: assetId,
        youtubeUrl: null,
      });
    });

    it('defaults to a link video for the current frontend', async () => {
      const response = await create({
        youtubeUrl: 'https://www.youtube.com/embed/abc',
      });
      expect(response.data).toMatchObject({ source: 'link', asset_id: null });
    });

    it.each([
      [
        'a file video with a URL',
        { source: 'file', asset_id: assetId, youtubeUrl: 'https://x.test/v' },
        'not youtubeUrl',
      ],
      [
        'a link video with an upload',
        { youtubeUrl: 'https://x.test/v', asset_id: assetId },
        'not asset_id',
      ],
      ['a file video without an upload', { source: 'file' }, 'needs asset_id'],
      ['a link video without a URL', {}, 'needs youtubeUrl'],
    ])('rejects %s', async (_name, body, message) => {
      owned(upload());
      await expect(create(body)).rejects.toThrow(message);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rejects an upload that is not a video', async () => {
      owned(
        upload({ originalFilename: 'modul.pdf', mimeType: 'application/pdf' }),
      );
      await expect(
        create({ source: 'file', asset_id: assetId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a video over the merchant level's per-file limit", async () => {
      owned(upload({ sizeBytes: String(2 * 1024 * 1024 * 1024) }));
      await expect(
        create({ source: 'file', asset_id: assetId }),
      ).rejects.toThrow('1 GB limit of the Basic merchant level');
    });

    it('switches a link video to a file and keeps a title-only edit simple', async () => {
      const video = {
        id: 'video-id',
        chapter_id: chapterId,
        source: 'link',
        youtubeUrl: null,
        asset_id: null,
      };
      manager.findOne.mockImplementation(async (entity) =>
        entity === Chapter ? { id: chapterId, class_id: classId } : video,
      );
      await expect(
        service.updateVideo(userId, classId, chapterId, 'video-id', {
          title: 'Baru',
        }),
      ).resolves.toMatchObject({ data: { title: 'Baru', source: 'link' } });

      owned(upload());
      const switched = await service.updateVideo(
        userId,
        classId,
        chapterId,
        'video-id',
        { source: 'file', asset_id: assetId },
      );
      expect(switched.data).toMatchObject({
        source: 'file',
        asset_id: assetId,
        youtubeUrl: null,
      });
      await expect(
        service.updateVideo(userId, classId, chapterId, 'video-id', {
          source: 'link',
        }),
      ).rejects.toThrow('needs youtubeUrl');
    });
  });

  describe('bab order', () => {
    const chapterIds = [
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003',
    ];
    beforeEach(() => {
      manager.find.mockImplementation(async (entity) =>
        entity === Chapter
          ? chapterIds.map((id, order) => ({ id, class_id: classId, order }))
          : [],
      );
    });

    it('stores a complete list in its new order', async () => {
      const [a, b, c] = chapterIds;
      const response = await service.reorderChapters(userId, classId, {
        chapter_ids: [c, a, b],
      });
      expect(response.data.map((chapter) => chapter.id)).toEqual([c, a, b]);
      expect(manager.update).toHaveBeenCalledWith(
        Chapter,
        { id: c },
        { order: 0, updated_by: userId },
      );
    });

    it.each([
      ['a missing chapter', chapterIds.slice(0, 2)],
      [
        'another class chapter',
        [...chapterIds.slice(0, 2), '70000000-0000-4000-8000-000000000009'],
      ],
    ])('rejects %s and changes nothing', async (_name, ids) => {
      await expect(
        service.reorderChapters(userId, classId, { chapter_ids: ids }),
      ).rejects.toThrow('every chapter of the class exactly once');
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('needs the content edit permission', async () => {
      access = {
        is_owner: false,
        role: 'moderator',
        permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
      };
      await expect(
        service.reorderChapters(userId, classId, { chapter_ids: chapterIds }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

describe('class content validation', () => {
  async function errorFields(target: new () => object, input: object) {
    const errors = await validate(plainToInstance(target, input));
    return errors.map((error) => error.property);
  }

  it.each([
    ['javascript:alert(1)', ['youtubeUrl']],
    ['http://youtube.com/watch?v=x', ['youtubeUrl']],
    ['https://www.youtube.com/embed/x', []],
  ])('video link %s', async (youtubeUrl, fields) => {
    expect(
      await errorFields(CreateVideoDto, { title: 'V', youtubeUrl }),
    ).toEqual(fields);
  });

  it.each([
    [{ type: 'pdf', name: 'Modul' }, ['resources']],
    [{ type: 'link', name: 'Ref', url: 'javascript:alert(1)' }, ['resources']],
    [
      {
        type: 'video',
        name: 'Lama',
        asset_id: '40000000-0000-4000-8000-000000000001',
      },
      ['resources'],
    ],
    [{ type: 'link', name: 'Ref', url: 'https://example.com' }, []],
    [
      {
        type: 'archive',
        name: 'Zip',
        asset_id: '40000000-0000-4000-8000-000000000001',
      },
      [],
    ],
  ])('resource %j', async (resource, fields) => {
    expect(
      await errorFields(AddResourcesDto, { resources: [resource] }),
    ).toEqual(fields);
  });

  it.each([
    [{ date: '2026-10-15', time: '25:99' }, ['time']],
    [{ date: '2026-02-30', time: '19:00' }, ['date']],
    [{ date: '15/10/2026', time: '19:00' }, ['date']],
    [
      { date: '2026-10-15', time: '19:00', liveUrl: 'http://zoom.us/j/1' },
      ['liveUrl'],
    ],
    [{ date: '2026-10-15', time: '19:00', liveUrl: 'https://zoom.us/j/1' }, []],
  ])('meeting %j', async (input, fields) => {
    expect(
      await errorFields(CreateMeetingDto, { title: 'Sesi 1', ...input }),
    ).toEqual(fields);
  });
});
