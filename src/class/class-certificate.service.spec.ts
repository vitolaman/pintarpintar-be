import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as learningEmails from '../api/email/events/learning-emails';
import * as assetRules from '../api/file-asset/asset-purpose-rules';
import { ClassCertificateService } from './class-certificate.service';
import { Certificate } from './entities/certificate.entity';

// A learner who has done nothing: no video, meeting attended or graded work.
const untouched = (userId: string) => ({
  user_id: userId,
  progress: 0,
  attendance_percent: 0,
  average_score: null,
  started_meetings: 1,
  graded_assignments: 0,
});

describe('ClassCertificateService issuing', () => {
  const classId = '30000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let saved: Record<string, unknown> | null;
  let learnerRows: unknown[];
  let assignments: number;
  let service: ClassCertificateService;

  beforeEach(() => {
    saved = null;
    assignments = 0;
    learnerRows = [
      {
        user_id: 'learner-id',
        progress: 100,
        attendance_percent: null,
        average_score: null,
        started_meetings: 0,
        graded_assignments: 0,
      },
    ];
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('AS today'))
          return [{ year: '2026', today: '2026-09-30' }];
        if (sql.includes('AS last')) return [{ last: 41 }];
        if (sql.includes('count(*)::integer AS assignments'))
          return [{ assignments }];
        if (sql.includes('WITH learners')) return learnerRows;
        return [];
      }),
      findOneBy: jest.fn(async () => saved),
      find: jest.fn(async () => []),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (_entity, value) => value),
      upsert: jest.fn(),
    };
    service = new ClassCertificateService(
      {
        manager,
        transaction: jest.fn((callback) => callback(manager)),
      } as never,
      { requireAction: jest.fn() } as never,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('numbers certificates per year after a year-scoped lock', async () => {
    const certificate = await service.issue(
      manager as never,
      classId,
      'learner-id',
    );

    expect(certificate).toMatchObject({
      certNo: 'PP-CERT-2026-0042',
      issueDate: '2026-09-30',
      status: 'issued',
    });
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['certificate-number:2026'],
    );
  });

  it('marks every learner without a certificate pending, whatever they did', async () => {
    learnerRows = [untouched('learner-id')];
    assignments = 2;

    const [state] = await service.loadStates(manager as never, classId);

    expect(state).toEqual({
      user_id: 'learner-id',
      status: 'pending',
      metrics: untouched('learner-id'),
      assignment_count: 2,
      certificate: null,
    });
  });

  it('marks a learner with a certificate issued', async () => {
    manager.find.mockResolvedValue([{ id: 'c1', user_id: 'learner-id' }]);

    const [state] = await service.loadStates(manager as never, classId);

    expect(state.status).toBe('issued');
  });

  it('saves the deprecated auto_issue switch without issuing anything', async () => {
    saved = { ...saved, auto_issue: false };

    await service.updateSettings('owner-id', classId, { auto_issue: true });

    expect(manager.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ class_id: classId, auto_issue: true }),
      ['class_id'],
    );
    expect(manager.save).not.toHaveBeenCalledWith(
      Certificate,
      expect.anything(),
    );
  });
});

describe('ClassCertificateService manual operations', () => {
  const classId = '30000000-0000-4000-8000-000000000001';
  const learnerId = '10000000-0000-4000-8000-000000000009';
  let learnerRows: unknown[];
  let certificates: unknown[];
  let manager: Record<string, jest.Mock>;
  let requireAction: jest.Mock;
  let service: ClassCertificateService;

  beforeEach(() => {
    requireAction = jest.fn();
    learnerRows = [
      {
        user_id: learnerId,
        progress: 100,
        attendance_percent: null,
        average_score: null,
        started_meetings: 0,
        graded_assignments: 0,
      },
    ];
    certificates = [];
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('AS today'))
          return [{ year: '2026', today: '2026-09-30' }];
        if (sql.includes('AS last')) return [{ last: 0 }];
        if (sql.includes('count(*)::integer AS assignments'))
          return [{ assignments: 0 }];
        if (sql.includes('WITH learners')) return learnerRows;
        return [];
      }),
      findOneBy: jest.fn(async () => null),
      find: jest.fn(async () => certificates),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (_entity, value) => value),
      update: jest.fn(),
    };
    service = new ClassCertificateService(
      {
        manager,
        transaction: jest.fn((callback) => callback(manager)),
      } as never,
      { requireAction } as never,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('issues a learner on request', async () => {
    await service.issueManually('tutor-id', classId, learnerId);

    expect(manager.save).toHaveBeenCalledWith(
      Certificate,
      expect.objectContaining({ user_id: learnerId, created_by: 'tutor-id' }),
    );
  });

  it('issues a learner who has no progress, attendance or grades', async () => {
    learnerRows = [untouched(learnerId)];

    const { data } = await service.issueManually(
      'tutor-id',
      classId,
      learnerId,
    );

    expect(manager.save).toHaveBeenCalledWith(
      Certificate,
      expect.objectContaining({ user_id: learnerId, created_by: 'tutor-id' }),
    );
    expect(data).toMatchObject({ progress: 0, attendance_percent: 0 });
  });

  it('refuses to issue twice', async () => {
    certificates = [{ id: 'certificate-id', user_id: learnerId }];

    await expect(
      service.issueManually('tutor-id', classId, learnerId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 for a learner not enrolled in the class', async () => {
    learnerRows = [];

    await expect(
      service.issueManually('tutor-id', classId, learnerId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('withdraws by soft-deleting the certificate', async () => {
    certificates = [{ id: 'certificate-id', user_id: learnerId }];

    await service.withdraw('tutor-id', classId, learnerId);

    expect(manager.update).toHaveBeenCalledWith(
      Certificate,
      { id: 'certificate-id' },
      expect.objectContaining({ deleted_by: 'tutor-id' }),
    );
  });

  describe('attaching a file', () => {
    let owned: jest.SpyInstance;
    const attach = () =>
      service.attachFile('tutor-id', classId, learnerId, 'asset-id');
    const savedCertificate = () =>
      manager.save.mock.calls.find(([entity]) => entity === Certificate)?.[1];

    let issuedEmail: jest.SpyInstance;

    beforeEach(() => {
      owned = jest
        .spyOn(assetRules, 'assertOwnedAsset')
        .mockResolvedValue({} as never);
      issuedEmail = jest
        .spyOn(learningEmails, 'queueCertificateIssuedEmail')
        .mockResolvedValue();
    });
    afterEach(() => {
      owned.mockRestore();
      issuedEmail.mockRestore();
    });

    it('replaces the file of an issued certificate', async () => {
      certificates = [{ id: 'certificate-id', user_id: learnerId }];

      await attach();

      expect(manager.update).toHaveBeenCalledWith(
        Certificate,
        { id: 'certificate-id' },
        { asset_id: 'asset-id', updated_by: 'tutor-id' },
      );
      expect(savedCertificate()).toBeUndefined();
      expect(requireAction.mock.calls.map((call) => call[3])).toEqual(['edit']);
    });

    // The frontend shows "Unggah File" for learners without a certificate.
    it('issues a learner a certificate with the file', async () => {
      const { responseMessage } = await attach();

      expect(requireAction.mock.calls.map((call) => call[3])).toEqual([
        'edit',
        'tambah',
      ]);
      expect(owned).toHaveBeenCalledWith(
        manager,
        'tutor-id',
        'asset-id',
        'certificate_file',
      );
      expect(savedCertificate()).toMatchObject({
        user_id: learnerId,
        asset_id: 'asset-id',
        created_by: 'tutor-id',
      });
      expect(responseMessage).toBe('Issue certificate with file success');
      expect(issuedEmail).toHaveBeenCalledTimes(1);
    });

    it('issues a learner who has done nothing a certificate with the file', async () => {
      learnerRows = [untouched(learnerId)];

      await attach();

      expect(savedCertificate()).toMatchObject({
        user_id: learnerId,
        asset_id: 'asset-id',
      });
      expect(issuedEmail).toHaveBeenCalledTimes(1);
    });

    it('needs the issue permission to issue', async () => {
      requireAction.mockImplementation(async (_u, _c, _area, action) => {
        if (action === 'tambah') throw new ForbiddenException();
      });

      await expect(attach()).rejects.toBeInstanceOf(ForbiddenException);
      expect(savedCertificate()).toBeUndefined();
    });
  });
});
