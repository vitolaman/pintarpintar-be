import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ClassService } from './class.service';
import { ClassMentor } from './entities/class-mentor.entity';

describe('ClassService.inviteMentor', () => {
  const ownerId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const mentorId = '50000000-0000-4000-8000-000000000001';
  const input = { email: ' Mentor@Example.com ', role: 'mentor' };
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
    );
  });

  it('assigns an active mentor found by email to the owner class', async () => {
    await expect(
      service.inviteMentor(ownerId, classId, input),
    ).resolves.toEqual(
      expect.objectContaining({
        class_id: classId,
        mentor_id: mentorId,
        role: 'mentor',
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
