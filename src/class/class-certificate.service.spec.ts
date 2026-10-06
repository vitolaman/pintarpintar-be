import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClassCertificateService,
  DEFAULT_CERTIFICATE_SETTINGS,
  isEligible,
} from './class-certificate.service';
import { Certificate } from './entities/certificate.entity';
import { LearnerMetrics } from './learner-metrics';

const metrics = (overrides: Partial<LearnerMetrics> = {}): LearnerMetrics => ({
  user_id: 'learner-id',
  progress: 100,
  attendance_percent: null,
  average_score: null,
  started_meetings: 0,
  graded_assignments: 0,
  ...overrides,
});
const settings = DEFAULT_CERTIFICATE_SETTINGS;

describe('certificate eligibility', () => {
  it('accepts a finished video class without meetings or assignments', () => {
    expect(isEligible(metrics(), settings, 0)).toBe(true);
  });

  it.each([
    ['unfinished videos', metrics({ progress: 99 }), 0],
    [
      'attendance below the minimum',
      metrics({ started_meetings: 4, attendance_percent: 75 }),
      0,
    ],
    ['no graded work in a class with assignments', metrics(), 1],
    [
      'an average below the minimum score',
      metrics({ average_score: 74.9, graded_assignments: 2 }),
      2,
    ],
    [
      'an assignment still ungraded or unsubmitted',
      metrics({ average_score: 90, graded_assignments: 1 }),
      2,
    ],
  ])('rejects %s', (_label, value, assignmentCount) => {
    expect(isEligible(value, settings, assignmentCount)).toBe(false);
  });

  it('accepts learners meeting every minimum', () => {
    expect(
      isEligible(
        metrics({
          started_meetings: 5,
          attendance_percent: 80,
          average_score: 75,
          graded_assignments: 2,
        }),
        settings,
        2,
      ),
    ).toBe(true);
  });

  it('ignores attendance when no meeting has started', () => {
    expect(isEligible(metrics({ attendance_percent: null }), settings, 0)).toBe(
      true,
    );
  });
});

describe('ClassCertificateService issuing', () => {
  const classId = '30000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let saved: Record<string, unknown> | null;
  let service: ClassCertificateService;

  beforeEach(() => {
    saved = null;
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('AS today'))
          return [{ year: '2026', today: '2026-09-30' }];
        if (sql.includes('AS last')) return [{ last: 41 }];
        if (sql.includes('count(*)::integer AS assignments'))
          return [{ assignments: 0 }];
        if (sql.includes('WITH learners')) {
          return [
            {
              user_id: 'learner-id',
              progress: 100,
              attendance_percent: null,
              average_score: null,
              started_meetings: 0,
              graded_assignments: 0,
            },
          ];
        }
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

  it('issues nothing automatically in manual mode', async () => {
    await service.issueEligible(manager as never, classId);

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('issues eligible learners automatically in auto mode', async () => {
    saved = { auto_issue: true, min_attendance_percent: 80, min_score: 75 };

    await service.issueEligible(manager as never, classId, ['learner-id']);

    expect(manager.save).toHaveBeenCalledWith(
      Certificate,
      expect.objectContaining({
        user_id: 'learner-id',
        certNo: 'PP-CERT-2026-0042',
      }),
    );
  });

  it('marks eligible learners pending in manual mode', async () => {
    const [state] = await service.loadStates(manager as never, classId);

    expect(state).toMatchObject({ status: 'pending', eligible: true });
  });
});

describe('ClassCertificateService manual operations', () => {
  const classId = '30000000-0000-4000-8000-000000000001';
  const learnerId = '10000000-0000-4000-8000-000000000009';
  let learnerRows: unknown[];
  let certificates: unknown[];
  let manager: Record<string, jest.Mock>;
  let service: ClassCertificateService;

  beforeEach(() => {
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
      { requireAction: jest.fn() } as never,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('issues an eligible learner on request', async () => {
    await service.issueManually('tutor-id', classId, learnerId);

    expect(manager.save).toHaveBeenCalledWith(
      Certificate,
      expect.objectContaining({ user_id: learnerId, created_by: 'tutor-id' }),
    );
  });

  it('refuses to issue an ineligible learner', async () => {
    learnerRows = [{ ...(learnerRows[0] as object), progress: 50 }];

    await expect(
      service.issueManually('tutor-id', classId, learnerId),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('needs an issued certificate to attach a file', async () => {
    await expect(
      service.attachFile('tutor-id', classId, learnerId, 'asset-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
