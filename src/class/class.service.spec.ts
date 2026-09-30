import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ClassAccessService } from './class-access.service';
import { DEFAULT_TUTOR_PERMISSIONS } from './class-permissions';
import { ClassService } from './class.service';
import { ClassMentor } from './entities/class-mentor.entity';

describe('ClassService.inviteMentor', () => {
  const ownerId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const mentorId = '50000000-0000-4000-8000-000000000001';
  const input = { email: ' Mentor@Example.com ', role: 'lead' as const };
  let manager: Record<string, jest.Mock>;
  let service: ClassService;

  beforeEach(() => {
    manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: classId }])
        .mockResolvedValueOnce([{ id: mentorId }]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (_target, value) => ({ ...value, id: 'link-id' })),
    };
    const classMentors = {
      manager: { transaction: jest.fn((callback) => callback(manager)) },
    } as unknown as Repository<ClassMentor>;
    const unused = {} as never;

    service = new ClassService(
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      classMentors,
      unused,
      unused,
    );
  });

  it('assigns an active mentor found by email to the owner class', async () => {
    await expect(
      service.inviteMentor(ownerId, classId, input),
    ).resolves.toEqual(
      expect.objectContaining({
        class_id: classId,
        mentor_id: mentorId,
        role: 'lead',
        permissions: expect.objectContaining({
          materi: { lihat: true, tambah: true, edit: true, delete: true },
        }),
      }),
    );
    expect(manager.query.mock.calls[0][0]).toContain('FOR UPDATE OF class');
    expect(manager.query.mock.calls[0][1]).toEqual([classId, ownerId]);
    expect(manager.query.mock.calls[1][1]).toEqual(['Mentor@Example.com']);
  });

  it('hides classes of other merchants behind 404', async () => {
    manager.query.mockReset().mockResolvedValueOnce([]);

    await expect(
      service.inviteMentor(ownerId, classId, input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an email without an active mentor account', async () => {
    manager.query
      .mockReset()
      .mockResolvedValueOnce([{ id: classId }])
      .mockResolvedValueOnce([]);

    await expect(
      service.inviteMentor(ownerId, classId, input),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a mentor already assigned to the class', async () => {
    manager.findOne.mockResolvedValue({ id: 'existing-link' });

    await expect(
      service.inviteMentor(ownerId, classId, input),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('ClassService access control', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  let query: jest.Mock;
  let classes: Record<string, unknown>;
  let chapters: Record<string, jest.Mock>;
  let enrollments: Record<string, jest.Mock>;
  let service: ClassService;

  beforeEach(() => {
    query = jest.fn();
    classes = {
      manager: { query },
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'new-id' })),
      findOne: jest.fn().mockResolvedValue({ id: classId }),
    };
    chapters = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
    };
    const builder: Record<string, jest.Mock> = {};
    for (const method of [
      'innerJoin',
      'where',
      'select',
      'orderBy',
      'addOrderBy',
      'offset',
      'limit',
    ]) {
      builder[method] = jest.fn(() => builder);
    }
    builder.getCount = jest.fn().mockResolvedValue(1);
    builder.getRawMany = jest.fn().mockResolvedValue([
      {
        id: 'enrollment-id',
        user_id: 'student-id',
        class_id: classId,
        joinDate: '2026-09-01',
        progress: '40',
        created_at: new Date('2026-09-01T00:00:00.000Z'),
        student_id: 'student-id',
        student_name: 'John Doe',
        student_email: 'john.doe@example.com',
      },
    ]);
    enrollments = { createQueryBuilder: jest.fn(() => builder) };
    const unused = {} as never;

    service = new ClassService(
      classes as never,
      chapters as never,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      enrollments as never,
      new ClassAccessService({ manager: { query } } as never),
    );
  });

  it.each([
    ['an unrelated user', [{ is_owner: false, role: null }]],
    ['an unknown class', []],
  ])('hides class detail from %s', async (_label, rows) => {
    query.mockResolvedValue(rows);

    await expect(service.getClassById(userId, classId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets a moderator see the class but not add chapters', async () => {
    query.mockResolvedValue([
      {
        is_owner: false,
        role: 'moderator',
        permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
      },
    ]);

    await expect(service.getClassById(userId, classId)).resolves.toEqual({
      id: classId,
    });
    await expect(
      service.createChapter(userId, classId, { title: 'Bab 1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(chapters.save).not.toHaveBeenCalled();
  });

  it('copies only declared fields when the owner creates a class', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);
    const input = {
      title: 'Kelas Baru',
      originalPrice: 100000,
      id: 'existing-class-of-another-merchant',
      merchant_id: 'someone-else',
    };

    await service.createClass(userId, merchantId, input as never);

    expect(classes.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: expect.anything() }),
    );
    expect(classes.create).toHaveBeenCalledWith(
      expect.objectContaining({ merchant_id: merchantId, title: 'Kelas Baru' }),
    );
  });

  it('rejects creating a class under a merchant the caller does not own', async () => {
    query.mockResolvedValue([]);

    await expect(
      service.createClass(userId, merchantId, { title: 'X' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(classes.save).not.toHaveBeenCalled();
  });

  it('rejects resources for a chapter of another class', async () => {
    query.mockResolvedValue([{ is_owner: true }]);
    chapters.findOne.mockResolvedValue(null);

    await expect(
      service.addResources(userId, classId, 'other-chapter', []),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists students without any credential field', async () => {
    query.mockResolvedValue([{ is_owner: true }]);

    const response = await service.getClassStudents(userId, classId);

    expect(response.data).toEqual([
      {
        id: 'enrollment-id',
        user_id: 'student-id',
        class_id: classId,
        joinDate: '2026-09-01',
        progress: '40',
        created_at: new Date('2026-09-01T00:00:00.000Z'),
        user: {
          id: 'student-id',
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
      },
    ]);
    expect(JSON.stringify(response)).not.toMatch(/password/i);
  });
});
