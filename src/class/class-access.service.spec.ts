import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClassAccessService, can } from './class-access.service';
import {
  CLASS_ACTIONS,
  CLASS_AREAS,
  DEFAULT_TUTOR_PERMISSIONS,
  parsePermissionMatrix,
} from './class-permissions';

describe('ClassAccessService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  let query: jest.Mock;
  let service: ClassAccessService;

  beforeEach(() => {
    query = jest.fn();
    service = new ClassAccessService({ manager: { query } } as never);
  });

  it.each(
    CLASS_AREAS.flatMap((area) =>
      CLASS_ACTIONS.map((action) => [area, action]),
    ),
  )('lets the owner %s.%s', async (area, action) => {
    query.mockResolvedValue([{ is_owner: true }]);

    await expect(
      service.requireAction(userId, classId, area as never, action as never),
    ).resolves.toEqual({ kind: 'owner' });
  });

  it.each(CLASS_AREAS)(
    'hides every %s action from an outsider',
    async (area) => {
      query.mockResolvedValue([{ is_owner: false, role: null }]);

      await expect(
        service.requireAction(userId, classId, area, 'lihat'),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it.each(
    CLASS_AREAS.flatMap((area) =>
      CLASS_ACTIONS.map((action) => [area, action]),
    ),
  )('grants a tutor %s.%s only when the matrix does', async (area, action) => {
    const permissions = parsePermissionMatrix({ [area]: { [action]: true } });
    query.mockResolvedValue([
      { is_owner: false, role: 'assistant', permissions },
    ]);

    await expect(
      service.requireAction(userId, classId, area as never, action as never),
    ).resolves.toMatchObject({ kind: 'tutor' });

    const otherArea = CLASS_AREAS.find((candidate) => candidate !== area);
    await expect(
      service.requireAction(
        userId,
        classId,
        otherArea as never,
        action as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps tutor management for the owner only', async () => {
    query.mockResolvedValue([
      {
        is_owner: false,
        role: 'lead',
        permissions: DEFAULT_TUTOR_PERMISSIONS.lead,
      },
    ]);

    await expect(service.requireOwner(userId, classId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('treats a tutor without a matrix as having no permissions', () => {
    expect(
      can(
        { kind: 'tutor', role: 'moderator', permissions: null },
        'meeting',
        'lihat',
      ),
    ).toBe(false);
  });
});

describe('permission matrix', () => {
  it('defaults lead to everything and moderator to meetings', () => {
    expect(DEFAULT_TUTOR_PERMISSIONS.lead.sertifikat.delete).toBe(true);
    expect(DEFAULT_TUTOR_PERMISSIONS.moderator.meeting.edit).toBe(true);
    expect(DEFAULT_TUTOR_PERMISSIONS.moderator.materi.tambah).toBe(false);
    expect(DEFAULT_TUTOR_PERMISSIONS.assistant.nilai.edit).toBe(true);
    expect(DEFAULT_TUTOR_PERMISSIONS.assistant.tugas.tambah).toBe(false);
  });

  it.each([
    [{ keuangan: { lihat: true } }],
    [{ materi: { unduh: true } }],
    [{ materi: { lihat: 'yes' } }],
    [['materi']],
  ])('rejects the malformed matrix %j', (input: unknown) => {
    expect(() => parsePermissionMatrix(input)).toThrow(BadRequestException);
  });
});
