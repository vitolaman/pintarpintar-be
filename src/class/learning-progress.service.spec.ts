import { NotFoundException } from '@nestjs/common';
import { Enrollment } from './entities/enrollment.entity';
import { VideoCompletion } from './entities/video-completion.entity';
import {
  LearningProgressService,
  parseProgress,
} from './learning-progress.service';

describe('LearningProgressService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const videoId = '50000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let insert: Record<string, jest.Mock>;
  let update: Record<string, jest.Mock>;
  let learnerAccess: { requireEnrollment: jest.Mock };
  let service: LearningProgressService;

  beforeEach(() => {
    insert = {};
    for (const method of ['insert', 'into', 'values', 'orIgnore']) {
      insert[method] = jest.fn(() => insert);
    }
    insert.execute = jest.fn();
    update = {};
    for (const method of ['update', 'set', 'where', 'andWhere']) {
      update[method] = jest.fn(() => update);
    }
    update.execute = jest.fn();
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT chapter.class_id'))
          return [{ class_id: classId }];
        if (sql.includes('AS progress FROM enrollments'))
          return [{ progress: '50' }];
        if (sql.includes('LIMIT 1')) {
          return [
            { id: 'next-video', title: 'Video 3', chapter_id: 'chapter-1' },
          ];
        }
        return [];
      }),
      createQueryBuilder: jest.fn(() => ({
        insert: insert.insert,
        update: update.update,
      })),
    };
    learnerAccess = { requireEnrollment: jest.fn() };
    service = new LearningProgressService(
      { transaction: jest.fn((callback) => callback(manager)) } as never,
      learnerAccess as never,
    );
  });

  it('records a completion once and recomputes the learner progress', async () => {
    const response = await service.completeVideo(userId, videoId);

    expect(learnerAccess.requireEnrollment).toHaveBeenCalledWith(
      userId,
      classId,
      manager,
    );
    expect(insert.into).toHaveBeenCalledWith(VideoCompletion);
    expect(insert.values).toHaveBeenCalledWith({
      user_id: userId,
      video_id: videoId,
      class_id: classId,
    });
    expect(insert.orIgnore).toHaveBeenCalled();
    expect(update.update).toHaveBeenCalledWith(Enrollment);
    expect(update.andWhere).toHaveBeenCalledWith('user_id = :userId', {
      userId,
    });
    expect(response.data).toEqual({
      class_id: classId,
      progress: 50,
      next_video: {
        id: 'next-video',
        title: 'Video 3',
        chapter_id: 'chapter-1',
      },
    });
  });

  it('returns 404 for an unknown or deleted video', async () => {
    manager.query.mockResolvedValueOnce([]);

    await expect(service.completeVideo(userId, videoId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(insert.execute).not.toHaveBeenCalled();
  });

  it('returns 404 when the learner is not enrolled', async () => {
    learnerAccess.requireEnrollment.mockRejectedValue(new NotFoundException());

    await expect(service.completeVideo(userId, videoId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(insert.execute).not.toHaveBeenCalled();
  });

  it('recomputes every enrollment of a class', async () => {
    await service.recomputeClass(manager as never, classId);

    const [[expression]] = update.set.mock.calls;
    expect(expression.progress()).toContain(
      'WHEN count(video.id) = 0 THEN 100',
    );
    expect(update.where).toHaveBeenCalledWith('class_id = :classId', {
      classId,
    });
    expect(update.andWhere).toHaveBeenCalledWith('deleted_at IS NULL');
    expect(update.andWhere).not.toHaveBeenCalledWith(
      'user_id = :userId',
      expect.anything(),
    );
  });
});

describe('parseProgress', () => {
  it.each([
    ['80', 80],
    ['85%', 85],
    ['66.7', 66],
    ['150', 100],
    [null, 0],
    ['belum mulai', 0],
  ])('reads %p as %p', (value, expected) => {
    expect(parseProgress(value)).toBe(expected);
  });
});
