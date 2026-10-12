import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { assertOwnedAsset } from '../api/file-asset/asset-purpose-rules';
import {
  NUMBER_PREFIX_PATTERN,
  nextPrefixedNumber,
} from './certificate-number';
import { certificateDelivery } from './certificate-template';
import {
  ClassCertificateService,
  LearnerCertificateState,
} from './class-certificate.service';
import {
  CertificateSettings,
  DEFAULT_CERTIFICATE_SETTINGS,
} from './certificate-settings';
import { UpdateCertificateSettingsDto } from './dto/certificate.dto';
import { Certificate } from './entities/certificate.entity';

jest.mock('../api/file-asset/asset-purpose-rules', () => ({
  ...jest.requireActual('../api/file-asset/asset-purpose-rules'),
  assertOwnedAsset: jest.fn(),
}));
jest.mock('../common/storage/signed-download-url', () => ({
  signedDownloadUrl: jest.fn(async (_storage, key: string) => `signed:${key}`),
}));

const classId = '30000000-0000-4000-8000-000000000001';
const learnerId = '10000000-0000-4000-8000-000000000009';

describe('certificate numbers', () => {
  it('starts a prefix at 0001', () => {
    expect(nextPrefixedNumber('CIVIL', [])).toBe('CIVIL-0001');
  });

  it('continues after the highest number of the prefix, withdrawn included', () => {
    expect(
      nextPrefixedNumber('CIVIL', ['CIVIL-0001', 'CIVIL-0007', 'CIVIL-0003']),
    ).toBe('CIVIL-0008');
  });

  it('ignores numbers of a longer prefix and other shapes', () => {
    expect(
      nextPrefixedNumber('CIVIL', ['CIVIL-A-0009', 'CIVIL-X1', 'CM-0004']),
    ).toBe('CIVIL-0001');
  });

  it('grows past four digits', () => {
    expect(nextPrefixedNumber('CM', ['CM-9999'])).toBe('CM-10000');
  });

  it.each(['CIVIL', 'cm', 'SIPIL/2026', 'A.B-1', 'X'])(
    'accepts %s',
    (prefix) => {
      expect(NUMBER_PREFIX_PATTERN.test(prefix)).toBe(true);
    },
  );

  it.each(['PP-CERT', 'pp-cert-x', '-CIVIL', 'CIVIL-', 'CI VIL', 'ÇIVIL', ''])(
    'refuses %p',
    (prefix) => {
      expect(NUMBER_PREFIX_PATTERN.test(prefix)).toBe(false);
    },
  );
});

describe('certificate delivery', () => {
  it.each([
    ['link', true, 'link'],
    ['link', false, 'link'],
    ['template', true, 'file'],
    ['template', false, 'template'],
  ] as const)('%s mode with a file %s is %s', (mode, hasFile, delivery) => {
    expect(certificateDelivery(mode, hasFile)).toBe(delivery);
  });
});

describe('certificate settings input', () => {
  async function errorFields(input: object) {
    const errors = await validate(
      plainToInstance(UpdateCertificateSettingsDto, input),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    return errors.map((error) => error.property);
  }

  it('accepts the template fields', async () => {
    expect(
      await errorFields({
        delivery_mode: 'Template',
        number_prefix: ' CIVIL ',
        class_name: 'Civil Mastery',
        mentor_name: 'Ir. Rexi Bara, S.T.',
        signature_asset_id: '40000000-0000-4000-8000-000000000001',
        show_score: true,
        certificate_url: 'https://drive.google.com/drive/folders/abc',
      }),
    ).toEqual([]);
  });

  it('turns blank text into null so it clears', () => {
    const input = plainToInstance(UpdateCertificateSettingsDto, {
      number_prefix: '  ',
      certificate_url: '',
      class_name: null,
    });
    expect(input).toMatchObject({
      number_prefix: null,
      certificate_url: null,
      class_name: null,
    });
  });

  it.each([
    [{ delivery_mode: 'upload' }, ['delivery_mode']],
    [{ delivery_mode: null }, ['delivery_mode']],
    [{ certificate_url: 'drive.google.com/abc' }, ['certificate_url']],
    [{ certificate_url: 'ftp://files.example.com/a' }, ['certificate_url']],
    [{ number_prefix: 'PP-CERT-X' }, ['number_prefix']],
    [{ number_prefix: 'A'.repeat(21) }, ['number_prefix']],
    [{ class_name: 'x'.repeat(151) }, ['class_name']],
    [{ signature_asset_id: 'not-a-uuid' }, ['signature_asset_id']],
    [{ show_score: 'yes' }, ['show_score']],
  ])('refuses %p', async (input, fields) => {
    expect(await errorFields(input)).toEqual(fields);
  });
});

describe('ClassCertificateService templates and links', () => {
  let savedSettings: Partial<CertificateSettings> | null;
  let queries: string[];
  let usedNumbers: string[];
  let manager: Record<string, jest.Mock>;
  let service: ClassCertificateService;

  beforeEach(() => {
    jest.mocked(assertOwnedAsset).mockReset();
    savedSettings = null;
    queries = [];
    usedNumbers = [];
    manager = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('AS today'))
          return [{ year: '2026', today: '2026-10-12' }];
        if (sql.includes('AS last')) return [{ last: 3 }];
        if (sql.includes('SELECT "certNo" FROM certificates'))
          return usedNumbers.map((certNo) => ({ certNo }));
        if (sql.includes('AS first_mentor_name'))
          return [
            {
              class_title: 'Civil Mastery Class 2',
              merchant_name: 'Media Sipil',
              logo_object_key: null,
              first_mentor_name: 'Rexi Bara',
            },
          ];
        if (sql.includes('SELECT id, name FROM users'))
          return [{ id: learnerId, name: 'Rexi Bara' }];
        if (sql.includes('FROM file_assets'))
          return [
            {
              id: 'signature-id',
              object_key: 'private/signature.png',
              original_filename: 'signature.png',
            },
          ];
        return [];
      }),
      findOneBy: jest.fn(async () =>
        savedSettings
          ? { ...DEFAULT_CERTIFICATE_SETTINGS, ...savedSettings }
          : null,
      ),
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

  const issuedState = (
    certificate: Partial<Certificate>,
  ): LearnerCertificateState => ({
    user_id: learnerId,
    status: 'issued',
    eligible: true,
    metrics: {
      user_id: learnerId,
      progress: 100,
      attendance_percent: null,
      average_score: 88.5,
      started_meetings: 0,
      graded_assignments: 2,
    },
    assignment_count: 2,
    certificate: {
      certNo: 'CIVIL-0001',
      issueDate: '2026-10-12',
      verification_code: '50000000-0000-4000-8000-000000000001',
      asset_id: null,
      ...certificate,
    } as Certificate,
  });

  it('numbers a prefixed class per class under a class lock', async () => {
    savedSettings = { number_prefix: 'CIVIL' };
    usedNumbers = ['CIVIL-0001', 'CIVIL-0002'];

    const certificate = await service.issue(
      manager as never,
      classId,
      learnerId,
    );

    expect(certificate.certNo).toBe('CIVIL-0003');
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`certificate-number:class:${classId}`],
    );
    expect(queries.some((sql) => sql.includes('AS last'))).toBe(false);
  });

  it('keeps PP-CERT numbers without a prefix', async () => {
    const certificate = await service.issue(
      manager as never,
      classId,
      learnerId,
    );

    expect(certificate.certNo).toBe('PP-CERT-2026-0004');
  });

  it('refuses link mode without a link', async () => {
    await expect(
      service.updateSettings('owner-id', classId, { delivery_mode: 'link' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.upsert).not.toHaveBeenCalled();
  });

  it('refuses clearing the link while in link mode', async () => {
    savedSettings = {
      delivery_mode: 'link',
      certificate_url: 'https://drive.example.com/a',
    };

    await expect(
      service.updateSettings('owner-id', classId, { certificate_url: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saves link mode and keeps omitted fields', async () => {
    savedSettings = { number_prefix: 'CIVIL', show_score: true };

    const result = await service.updateSettings('owner-id', classId, {
      delivery_mode: 'link',
      certificate_url: 'https://drive.example.com/a',
    });

    expect(manager.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        class_id: classId,
        delivery_mode: 'link',
        certificate_url: 'https://drive.example.com/a',
        number_prefix: 'CIVIL',
        show_score: true,
      }),
      ['class_id'],
    );
    expect(result.data).toMatchObject({
      default_class_name: 'Civil Mastery Class 2',
      default_mentor_name: 'Rexi Bara',
    });
  });

  it('checks a newly chosen signature', async () => {
    await service.updateSettings('owner-id', classId, {
      signature_asset_id: 'signature-id',
    });

    expect(assertOwnedAsset).toHaveBeenCalledWith(
      manager,
      'owner-id',
      'signature-id',
      'certificate_signature',
    );
  });

  it('does not recheck the saved signature', async () => {
    savedSettings = { signature_asset_id: 'signature-id' };

    const result = await service.updateSettings('tutor-id', classId, {
      signature_asset_id: 'signature-id',
      show_score: true,
    });

    expect(assertOwnedAsset).not.toHaveBeenCalled();
    expect(result.data.signature_url).toBe('signed:private/signature.png');
  });

  it('gives the link only to an issued certificate in link mode', async () => {
    const settings: CertificateSettings = {
      ...DEFAULT_CERTIFICATE_SETTINGS,
      delivery_mode: 'link',
      certificate_url: 'https://drive.example.com/a',
    };
    const pending: LearnerCertificateState = {
      ...issuedState({}),
      status: 'ineligible',
      eligible: false,
      certificate: null,
    };

    const [issued, notIssued] = await service.toViews(
      manager as never,
      classId,
      [issuedState({}), pending],
      settings,
    );

    expect(issued).toMatchObject({
      delivery: 'link',
      certificate_url: 'https://drive.example.com/a',
      template: null,
    });
    expect(notIssued).toMatchObject({
      delivery: null,
      certificate_url: null,
      template: null,
    });
  });

  it('builds template data with defaults and the score hidden', async () => {
    const [view] = await service.toViews(
      manager as never,
      classId,
      [issuedState({})],
      { ...DEFAULT_CERTIFICATE_SETTINGS },
    );

    expect(view.delivery).toBe('template');
    expect(view.requirements).toEqual({
      auto_issue: false,
      min_attendance_percent: 80,
      min_score: 75,
    });
    expect(view.template).toEqual({
      cert_no: 'CIVIL-0001',
      issue_date: '2026-10-12',
      learner_name: 'Rexi Bara',
      class_name: 'Civil Mastery Class 2',
      merchant_name: 'Media Sipil',
      merchant_logo_url: null,
      mentor_name: 'Rexi Bara',
      signature_url: null,
      show_score: false,
      final_score: null,
      verification_code: '50000000-0000-4000-8000-000000000001',
    });
  });

  it('uses the overrides, the signature and the score when shown', async () => {
    const [view] = await service.toViews(
      manager as never,
      classId,
      [issuedState({})],
      {
        ...DEFAULT_CERTIFICATE_SETTINGS,
        class_name: 'Civil Mastery',
        mentor_name: 'Ir. Rexi Bara, S.T.',
        signature_asset_id: 'signature-id',
        show_score: true,
      },
    );

    expect(view.template).toMatchObject({
      class_name: 'Civil Mastery',
      mentor_name: 'Ir. Rexi Bara, S.T.',
      signature_url: 'signed:private/signature.png',
      show_score: true,
      final_score: 88.5,
    });
  });

  it('serves an uploaded file instead of the template', async () => {
    const [view] = await service.toViews(
      manager as never,
      classId,
      [issuedState({ asset_id: 'signature-id' })],
      { ...DEFAULT_CERTIFICATE_SETTINGS },
    );

    expect(view).toMatchObject({
      delivery: 'file',
      file_download_url: 'signed:private/signature.png',
      template: null,
    });
  });
});
