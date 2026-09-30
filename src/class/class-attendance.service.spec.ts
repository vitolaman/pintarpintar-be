import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClassAccessService } from './class-access.service';
import { ClassAttendanceService } from './class-attendance.service';
import { DEFAULT_TUTOR_PERMISSIONS } from './class-permissions';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

describe('ClassAttendanceService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const meetingId = '80000000-0000-4000-8000-000000000001';
  let meeting: Record<string, unknown> | null;
  let access: Record<string, unknown> | null;
  let existing: Record<string, unknown> | null;
  let enrolled: boolean;
  let manager: Record<string, jest.Mock>;
  let learnerAccess: { requireEnrollment: jest.Mock };
  let service: ClassAttendanceService;

  beforeEach(() => {
    meeting = {
      id: meetingId,
      class_id: classId,
      title: 'Sesi 1',
      has_started: true,
    };
    access = { is_owner: true };
    existing = null;
    enrolled = true;
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('AS has_started')) return meeting ? [meeting] : [];
        if (sql.includes('AS is_owner')) return access ? [access] : [];
        if (sql.includes('AS time')) return [{ time: '19:05:00' }];
        if (sql.includes('FROM classes class')) {
          return [
            {
              id: classId,
              title: 'Kelas',
              type: 'live-bootcamp',
              merchant_name: 'Akademi',
            },
          ];
        }
        if (sql.includes('SELECT 1 FROM enrollments'))
          return enrolled ? [{}] : [];
        return [];
      }),
      findOne: jest.fn(async () => existing),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (_entity, value) => value),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    learnerAccess = { requireEnrollment: jest.fn() };
    service = new ClassAttendanceService(
      dataSource as never,
      new ClassAccessService(dataSource as never),
      learnerAccess as never,
    );
  });

  const saved = () =>
    manager.save.mock.calls.find(([entity]) => entity === Attendance)?.[1];

  it('checks the signed-in learner in as hadir with the Jakarta time', async () => {
    await service.checkIn(userId, meetingId, 'Materi jelas');

    expect(saved()).toMatchObject({
      meeting_id: meetingId,
      user_id: userId,
      status: AttendanceStatus.HADIR,
      checkInTime: '19:05:00',
      notes: 'Materi jelas',
    });
  });

  it('keeps the first check-in time and replaces the review', async () => {
    existing = { status: 'hadir', checkInTime: '18:00:00', notes: 'Awal' };

    await service.checkIn(userId, meetingId, 'Revisi');

    expect(saved()).toMatchObject({ checkInTime: '18:00:00', notes: 'Revisi' });
  });

  it('refuses a check-in before the meeting starts', async () => {
    meeting = { ...meeting, has_started: false };

    await expect(service.checkIn(userId, meetingId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('hides meetings of classes the learner is not enrolled in', async () => {
    learnerAccess.requireEnrollment.mockRejectedValue(new NotFoundException());

    await expect(service.checkIn(userId, meetingId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets a tutor with meeting permission mark a learner izin', async () => {
    access = {
      is_owner: false,
      role: 'moderator',
      permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
    };

    await service.setStatus(
      userId,
      classId,
      meetingId,
      'learner-id',
      AttendanceStatus.IZIN,
    );

    expect(saved()).toMatchObject({ user_id: 'learner-id', status: 'izin' });
  });

  it('forbids tutors without meeting permission', async () => {
    access = {
      is_owner: false,
      role: 'assistant',
      permissions: DEFAULT_TUTOR_PERMISSIONS.assistant,
    };

    await expect(
      service.setStatus(
        userId,
        classId,
        meetingId,
        'learner-id',
        AttendanceStatus.HADIR,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 for a learner not enrolled in the class', async () => {
    enrolled = false;

    await expect(
      service.setStatus(
        userId,
        classId,
        meetingId,
        'stranger',
        AttendanceStatus.HADIR,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
