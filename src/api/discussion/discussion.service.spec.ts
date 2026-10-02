import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ThreadBadge } from '../../class/entities/discussion-thread.entity';
import { DiscussionService } from './discussion.service';

describe('DiscussionService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const threadId = '40000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let dataSource: {
    transaction: jest.Mock;
    query: jest.Mock;
    manager: unknown;
  };
  let service: DiscussionService;

  const threadInput = {
    class_id: classId,
    title: 'Jadwal sesi',
    badge: ThreadBadge.PENGUMUMAN,
    content: 'Sesi dimulai pukul 19.00 WIB.',
  };

  beforeEach(() => {
    manager = {
      query: jest.fn(),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (_target, value) => ({ ...value, id: 'new-id' })),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      query: jest.fn().mockResolvedValue([
        {
          id: 'new-id',
          class_id: classId,
          thread_id: threadId,
          title: 'Jadwal sesi',
          content: 'isi',
          badge: ThreadBadge.PENGUMUMAN,
          created_at: new Date('2026-09-30T00:00:00.000Z'),
          author_role: 'mentor',
          author_id: userId,
          author_name: 'Mentor Test',
          author_avatar_object_key: null,
          comment_count: 0,
        },
      ]),
      manager,
    };
    service = new DiscussionService(dataSource as unknown as DataSource);
  });

  it('lets an assigned mentor start a thread as the author', async () => {
    manager.query.mockResolvedValue([{ role: 'mentor' }]);

    const response = await service.createThread(userId, threadInput);

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        class_id: classId,
        author_id: userId,
        author_role: 'mentor',
        badge: ThreadBadge.PENGUMUMAN,
      }),
    );
    expect(response.data.author).toMatchObject({
      id: userId,
      role: 'mentor',
      avatar_url: null,
    });
  });

  it('forbids an enrolled learner from starting a thread', async () => {
    manager.query.mockResolvedValue([{ role: 'student' }]);

    await expect(
      service.createThread(userId, threadInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each([[[]], [[{ role: null }]]])(
    'hides the class from a user with no part in it (%j)',
    async (rows) => {
      manager.query.mockResolvedValue(rows);

      await expect(
        service.createThread(userId, threadInput),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('lets an enrolled learner reply with the student role', async () => {
    manager.query
      .mockResolvedValueOnce([{ class_id: classId }])
      .mockResolvedValueOnce([{ role: 'student' }]);

    await service.createComment(userId, {
      thread_id: threadId,
      content: 'Terima kasih!',
    });

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        thread_id: threadId,
        author_id: userId,
        author_role: 'student',
      }),
    );
  });

  it('returns 404 when replying to an unknown thread', async () => {
    manager.query.mockResolvedValueOnce([]);

    await expect(
      service.createComment(userId, { thread_id: threadId, content: 'Halo' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists threads newest first with their replies', async () => {
    (dataSource.manager as Record<string, jest.Mock>).query = jest
      .fn()
      .mockResolvedValue([{ role: 'student' }]);
    dataSource.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          id: threadId,
          class_id: classId,
          title: 'Jadwal sesi',
          content: 'isi',
          badge: ThreadBadge.PENGUMUMAN,
          created_at: new Date('2026-09-30T00:00:00.000Z'),
          author_role: 'merchant',
          author_id: 'owner-id',
          author_name: 'Budi Santoso',
          author_avatar_object_key: null,
          comment_count: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'comment-id',
          thread_id: threadId,
          content: 'Siap',
          created_at: new Date('2026-09-30T01:00:00.000Z'),
          author_role: 'student',
          author_id: userId,
          author_name: 'John Doe',
          author_avatar_object_key: null,
        },
      ]);

    const response = await service.findThreads(userId, classId, {
      class_id: classId,
      page: 1,
      limit: 20,
    });

    expect(response.data[0]).toMatchObject({
      id: threadId,
      comment_count: 1,
      author: { name: 'Budi Santoso', role: 'merchant' },
      comments: [{ id: 'comment-id', author: { role: 'student' } }],
    });
    expect(response.meta.total).toBe(1);
  });
});
