import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MentorWorkspaceService } from './mentor-workspace.service';

describe('MentorWorkspaceService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const mentorId = '50000000-0000-4000-8000-000000000001';
  let query: jest.Mock;
  let service: MentorWorkspaceService;

  beforeEach(() => {
    query = jest.fn();
    service = new MentorWorkspaceService({ query } as unknown as DataSource);
  });

  it.each(['findDashboard', 'findClasses', 'findTeachingClasses'] as const)(
    '%s returns 404 for a user without an active mentor record',
    async (method) => {
      query.mockResolvedValueOnce([]);

      await expect(
        (service[method] as (id: string, q?: unknown) => Promise<unknown>)(
          userId,
          {},
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('builds the dashboard stats, sessions, messages, and progress', async () => {
    query
      .mockResolvedValueOnce([{ id: mentorId }])
      .mockResolvedValueOnce([
        {
          active_classes: 2,
          active_classes_this_month: 1,
          total_students: 12,
          students_this_week: 3,
          upcoming_sessions: 1,
          rating: '4.7',
          review_count: 9,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'meeting-id',
          title: 'Sesi 2',
          date: '2026-10-02',
          time: '19:00',
          class_id: 'class-id',
          class_title: 'PLC Programming Bootcamp',
          class_type: 'live-bootcamp',
          student_count: 5,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          class_id: 'class-id',
          title: 'PLC Programming Bootcamp',
          type: 'live-bootcamp',
          enrolled_count: 5,
          average_progress: '62.5',
        },
      ]);

    const { data } = await service.findDashboard(userId);

    expect(data.stats).toEqual({
      active_classes: 2,
      active_classes_this_month: 1,
      total_students: 12,
      students_this_week: 3,
      upcoming_sessions: 1,
      rating: 4.7,
      review_count: 9,
    });
    expect(data.upcoming_sessions[0].class_type).toBe('bootcamp');
    expect(data.class_progress[0]).toMatchObject({
      type: 'bootcamp',
      average_progress: 62.5,
    });
    expect(query.mock.calls[1][1]).toEqual([mentorId]);
  });

  it('maps type filters to class types and escapes the search', async () => {
    query.mockResolvedValueOnce([{ id: mentorId }]).mockResolvedValueOnce([]);

    await service.findClasses(userId, { type: 'kelas', search: '50%_off' });

    expect(query.mock.calls[1][1]).toEqual([mentorId, 'video', '50\\%\\_off']);
  });

  it('marks removed or unpublished assignments inactive', async () => {
    query.mockResolvedValueOnce([{ id: mentorId }]).mockResolvedValueOnce([
      {
        id: 'class-old',
        title: 'Kelas Lama',
        status: 'published',
        class_deleted_at: null,
        started_at: new Date('2024-02-01T00:00:00.000Z'),
        ended_at: new Date('2025-06-01T00:00:00.000Z'),
        merchant_id: 'merchant-id',
        merchant_name: 'Akademi Teknik Budi',
        merchant_city: 'Surabaya',
        merchant_avatar_object_key: null,
      },
      {
        id: 'class-now',
        title: 'Kelas Aktif',
        status: 'published',
        class_deleted_at: null,
        started_at: new Date('2026-01-10T00:00:00.000Z'),
        ended_at: null,
        merchant_id: 'merchant-id',
        merchant_name: 'Akademi Teknik Budi',
        merchant_city: 'Surabaya',
        merchant_avatar_object_key: null,
      },
    ]);

    const { data } = await service.findTeachingClasses(userId);

    expect(data.map((row) => [row.id, row.status, row.end_year])).toEqual([
      ['class-now', 'active', null],
      ['class-old', 'inactive', 2025],
    ]);
  });
});
