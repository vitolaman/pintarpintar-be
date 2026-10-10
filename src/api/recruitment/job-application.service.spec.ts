import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import { DEFAULT_TUTOR_PERMISSIONS } from '~/class/class-permissions';
import { ClassMentor } from '~/class/entities/class-mentor.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Mentor } from '../mentor/entities/mentor.entity';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { User } from '../user/entities/user.entity';
import {
  ApplicantQueryDto,
  ApplyJobDto,
  MyApplicationQueryDto,
  ScheduleInterviewDto,
} from './dto/job-application.dto';
import { JobApplication } from './entities/job-application.entity';
import { MerchantMentor } from './entities/merchant-mentor.entity';
import { JobApplicationService } from './job-application.service';

const ownerId = '10000000-0000-4000-8000-000000000001';
const applicantId = '10000000-0000-4000-8000-000000000002';
const merchantId = '20000000-0000-4000-8000-000000000001';
const jobId = '30000000-0000-4000-8000-000000000001';
const applicationId = '50000000-0000-4000-8000-000000000001';
const classId = '40000000-0000-4000-8000-000000000001';
const cvId = '60000000-0000-4000-8000-000000000001';
const mentorId = '70000000-0000-4000-8000-000000000001';

const applyInput: ApplyJobDto = {
  name: 'Budi',
  email: 'budi@example.com',
  phone: '+62 812',
  linkedin_url: 'https://linkedin.com/in/budi',
  cv_asset_id: cvId,
};

async function errorFields(target: new () => object, value: object) {
  const errors = await validate(plainToInstance(target, value));
  return errors.map((error) => error.property);
}

describe('job application DTOs', () => {
  it.each([
    [{}, []],
    [{ linkedin_url: 'javascript:alert(1)' }, ['linkedin_url']],
    [{ linkedin_url: 'linkedin' }, ['linkedin_url']],
    [{ linkedin_url: 'https://x.co/' + 'a'.repeat(500) }, ['linkedin_url']],
    [{ email: 'budi' }, ['email']],
    [{ cv_asset_id: 'cv' }, ['cv_asset_id']],
    [{ name: null }, ['name']],
    [{ note: null }, []],
  ])('validates an application %j', async (value, fields) => {
    expect(await errorFields(ApplyJobDto, { ...applyInput, ...value })).toEqual(
      fields,
    );
  });

  it.each([
    [{ interview_at: '2026-11-15T10:00:00+07:00' }, []],
    [{ interview_at: '2026-11-15T03:00:00Z' }, []],
    [{ interview_at: '2026-11-15T10:00' }, ['interview_at']],
    [{ interview_at: '15/11/2026' }, ['interview_at']],
    [{ interview_url: 'ftp://meet.example' }, ['interview_url']],
  ])('validates an interview %j', async (value, fields) => {
    expect(
      await errorFields(ScheduleInterviewDto, {
        interview_at: '2026-11-15T10:00:00+07:00',
        interview_url: 'https://meet.google.com/abc',
        ...value,
      }),
    ).toEqual(fields);
  });

  it.each([[''], ['   '], [null]])('clears the note with %j', async (note) => {
    const dto = plainToInstance(ApplyJobDto, { ...applyInput, note });
    expect(dto.note).toBeNull();
    expect(await validate(dto)).toEqual([]);
  });

  it.each([[''], ['   '], [null], [undefined]])(
    'accepts an application without LinkedIn given %j',
    async (linkedin_url) => {
      const dto = plainToInstance(ApplyJobDto, { ...applyInput, linkedin_url });
      expect(await validate(dto)).toEqual([]);
      expect(dto.linkedin_url ?? null).toBeNull();
    },
  );

  it.each([[''], ['   '], [null]])('rejects a phone of %j', async (phone) => {
    expect(await errorFields(ApplyJobDto, { ...applyInput, phone })).toEqual([
      'phone',
    ]);
  });

  it.each([[''], [null]])('rejects an interview link of %j', async (url) => {
    expect(
      await errorFields(ScheduleInterviewDto, {
        interview_at: '2026-11-15T10:00:00+07:00',
        interview_url: url,
      }),
    ).toEqual(['interview_url']);
  });

  it('treats blank applicant filters as no filter', async () => {
    const query = plainToInstance(ApplicantQueryDto, {
      status: '',
      job_id: ' ',
      search: '  ',
    });
    expect(query).toMatchObject({
      status: undefined,
      job_id: undefined,
      search: undefined,
    });
    expect(await validate(query)).toEqual([]);
  });

  it('matches the status filter ignoring case', async () => {
    const query = plainToInstance(MyApplicationQueryDto, {
      status: ' Interview ',
    });
    expect(query.status).toBe('interview');
    expect(await validate(query)).toEqual([]);
    expect(
      await errorFields(MyApplicationQueryDto, { status: 'pending' }),
    ).toEqual(['status']);
  });
});

describe('JobApplicationService', () => {
  let manager: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;
  let service: JobApplicationService;
  let locked: Record<string, unknown> | undefined;
  let applicant: Partial<User> | null;
  let mentor: Partial<Mentor> | null;
  let listEntry: Partial<MerchantMentor> | null;
  let tutorLink: Partial<ClassMentor> | null;

  beforeEach(() => {
    locked = {
      id: applicationId,
      status: 'review',
      applicant_user_id: applicantId,
      merchant_id: merchantId,
      class_id: classId,
    };
    applicant = { id: applicantId, isMentor: false };
    mentor = null;
    listEntry = null;
    tutorLink = null;
    manager = {
      findOne: jest.fn(async (target) => {
        if (target === Merchant) return { id: merchantId, status: 'active' };
        if (target === User) return applicant;
        if (target === Mentor) return mentor;
        if (target === MerchantMentor) return listEntry;
        if (target === ClassMentor) return tutorLink;
        return null;
      }),
      findOneBy: jest.fn(async (target) =>
        target === FileAsset
          ? {
              id: cvId,
              uploadedByUserId: applicantId,
              status: 'active',
              visibility: 'private',
              originalFilename: 'cv.pdf',
              mimeType: 'application/pdf',
              sizeBytes: '1000',
            }
          : null,
      ),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE OF application')) {
          return locked ? [locked] : [];
        }
        if (sql.includes('FOR SHARE OF job')) {
          return [{ id: jobId, owner_user_id: ownerId }];
        }
        if (sql.includes('FROM classes')) return [{ id: classId }];
        return [];
      }),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (value) => ({ ...value, id: mentorId })),
      update: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      manager: manager as never,
      query: jest.fn().mockResolvedValue([
        {
          id: applicationId,
          status: 'accepted',
          experience_years: null,
          cv_filename: 'cv.pdf',
          cv_size: '1000',
        },
      ]),
    };
    service = new JobApplicationService(
      dataSource as unknown as DataSource,
      new ConfigService({}),
    );
  });

  it('maps a lost race on the unique index to 409', async () => {
    const duplicate = new QueryFailedError('INSERT', [], new Error('dup'));
    (duplicate as unknown as { code: string }).code = '23505';
    manager.save.mockRejectedValue(duplicate);

    await expect(
      service.apply(applicantId, jobId, applyInput),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores an application without LinkedIn as null', async () => {
    await service
      .apply(applicantId, jobId, { ...applyInput, linkedin_url: undefined })
      .catch(() => undefined);
    expect(manager.create).toHaveBeenCalledWith(
      JobApplication,
      expect.objectContaining({ linkedinUrl: null }),
    );
  });

  it('rejects applying to the merchant own vacancy', async () => {
    await expect(
      service.apply(ownerId, jobId, applyInput),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each([
    ['interview', 'review', true],
    ['interview', 'interview', true],
    ['interview', 'rejected', false],
    ['interview', 'accepted', false],
    ['reject', 'review', true],
    ['reject', 'interview', true],
    ['reject', 'rejected', false],
    ['reject', 'accepted', false],
    ['accept', 'rejected', true],
    ['accept', 'accepted', false],
  ])('%s from %s allowed: %s', async (action, status, allowed) => {
    locked = { ...locked, status };
    const run = {
      interview: () =>
        service.scheduleInterview(ownerId, applicationId, {
          interview_at: '2026-11-15T10:00:00+07:00',
          interview_url: 'https://meet.google.com/abc',
        }),
      reject: () => service.reject(ownerId, applicationId),
      accept: () => service.accept(ownerId, applicationId),
    }[action as 'interview' | 'reject' | 'accept'];

    if (allowed) {
      await expect(run()).resolves.toBeDefined();
      expect(manager.update).toHaveBeenCalledWith(
        JobApplication,
        { id: applicationId },
        expect.anything(),
      );
    } else {
      await expect(run()).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.update).not.toHaveBeenCalled();
    }
  });

  it('hides an application of another merchant', async () => {
    locked = undefined;
    await expect(service.reject(ownerId, applicationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('grants the mentor role, the mentor list entry and an assistant seat', async () => {
    await service.accept(ownerId, applicationId);

    expect(manager.create).toHaveBeenCalledWith(Mentor, {
      userId: applicantId,
      status: 'active',
    });
    expect(manager.update).toHaveBeenCalledWith(
      User,
      { id: applicantId },
      { isMentor: true },
    );
    expect(manager.create).toHaveBeenCalledWith(
      MerchantMentor,
      expect.objectContaining({
        merchantId,
        mentorUserId: applicantId,
        status: 'active',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(ClassMentor, {
      class_id: classId,
      mentor_id: mentorId,
      role: 'assistant',
      permissions: DEFAULT_TUTOR_PERMISSIONS.assistant,
      created_by: ownerId,
    });
  });

  it('keeps an existing tutor link and reactivates an ended list entry', async () => {
    mentor = { id: mentorId, status: 'active' };
    applicant = { id: applicantId, isMentor: true };
    listEntry = { id: 'entry', status: 'ended' };
    tutorLink = { id: 'link' };

    await service.accept(ownerId, applicationId);

    expect(manager.create).not.toHaveBeenCalledWith(Mentor, expect.anything());
    expect(manager.create).not.toHaveBeenCalledWith(
      ClassMentor,
      expect.anything(),
    );
    expect(manager.update).toHaveBeenCalledWith(
      MerchantMentor,
      { id: 'entry' },
      expect.objectContaining({ status: 'active', endedAt: null }),
    );
  });

  it.each([
    ['a deleted applicant', () => (applicant = null)],
    [
      'an inactive mentor record',
      () => (mentor = { id: mentorId, status: 'suspended' }),
    ],
  ])('refuses %s with 409', async (_label, arrange) => {
    arrange();
    await expect(service.accept(ownerId, applicationId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalledWith(
      JobApplication,
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('JobApplicationService applicants', () => {
  const applicantRow = (id: string, mentorIdValue: string | null) => ({
    id,
    status: 'review',
    user_id: applicantId,
    mentor_id: mentorIdValue,
    name: 'Budi',
    experience_years: null,
    job_id: jobId,
    job_title: 'Tutor AutoCAD',
    cv_filename: 'cv.pdf',
    cv_size: '1000',
  });

  it("gives each applicant the user's mentor id from the list query", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('AS mentor_id')) {
        return [
          applicantRow('application-1', mentorId),
          applicantRow('application-2', null),
          applicantRow('application-3', mentorId),
        ];
      }
      if (sql.includes('AS total')) return [{ total: 3 }];
      return [{ all: 3 }];
    });
    const service = new JobApplicationService(
      {
        query,
        manager: {
          findOne: jest.fn(async () => ({ id: merchantId, status: 'active' })),
        },
      } as unknown as DataSource,
      new ConfigService({}),
    );

    const { data } = await service.findApplicants(
      ownerId,
      plainToInstance(ApplicantQueryDto, {}),
    );

    expect(data.applicants.map((row) => [row.id, row.mentor_id])).toEqual([
      ['application-1', mentorId],
      ['application-2', null],
      ['application-3', mentorId],
    ]);
    expect(query).toHaveBeenCalledTimes(3);
    const [listSql] = query.mock.calls.find(([sql]) =>
      sql.includes('AS mentor_id'),
    ) as [string];
    expect(listSql).toContain("CASE WHEN mentor.status = 'active'");
  });
});
