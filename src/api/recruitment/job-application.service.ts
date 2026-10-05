import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { DEFAULT_TUTOR_PERMISSIONS } from '~/class/class-permissions';
import { ClassMentor } from '~/class/entities/class-mentor.entity';
import { assetUrl } from '~/common/storage/asset-url';
import {
  ObjectStorage,
  createObjectStorage,
} from '~/common/storage/object-storage';
import { signedDownloadUrl } from '~/common/storage/signed-download-url';
import { escapeLike } from '~/common/util/escape-like';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import { Mentor } from '../mentor/entities/mentor.entity';
import { User } from '../user/entities/user.entity';
import {
  ApplicantQueryDto,
  ApplicantResponseDto,
  ApplicationCountsDto,
  ApplyJobDto,
  MyApplicationQueryDto,
  MyApplicationResponseDto,
  ScheduleInterviewDto,
} from './dto/job-application.dto';
import { JobApplication } from './entities/job-application.entity';
import { MerchantMentor } from './entities/merchant-mentor.entity';
import { ApplicationStatus } from './recruitment.constants';
import { findOwnMerchant } from './recruitment-merchant';
import { ACTIVE_MENTOR_ID_SQL, PUBLIC_JOB_SQL } from './recruitment-sql';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { queueApplicationEmail } from '~/api/email/events/recruitment-emails';

const UNIQUE_VIOLATION = '23505';

// Which statuses each merchant action may start from. Acceptance is final.
const ALLOWED_FROM: Record<
  'interview' | 'accept' | 'reject',
  ApplicationStatus[]
> = {
  interview: ['review', 'interview'],
  reject: ['review', 'interview'],
  accept: ['review', 'interview', 'rejected'],
};

const COUNTS_SQL = `count(*)::integer AS all,
  count(*) FILTER (WHERE application.status = 'review')::integer AS review,
  count(*) FILTER (WHERE application.status = 'interview')::integer AS interview,
  count(*) FILTER (WHERE application.status = 'accepted')::integer AS accepted,
  count(*) FILTER (WHERE application.status = 'rejected')::integer AS rejected`;

const APPLICANT_COLUMNS_SQL = `application.id, application.status, application.created_at,
  application.interview_at, application.interview_url, application.decided_at,
  application.applicant_user_id AS user_id, ${ACTIVE_MENTOR_ID_SQL} AS mentor_id,
  application.name, application.email, application.phone, application.linkedin_url, application.note,
  avatar.object_key AS avatar_object_key, profile.headline, mentor_profile.experience_years,
  job.id AS job_id, job.title AS job_title,
  cv.original_filename AS cv_filename, cv.size_bytes AS cv_size`;

const APPLICANT_JOINS_SQL = `FROM job_applications application
  INNER JOIN job_postings job ON job.id = application.job_posting_id
  INNER JOIN users applicant ON applicant.id = application.applicant_user_id
  LEFT JOIN user_profiles profile
    ON profile.user_id = applicant.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
  LEFT JOIN mentors mentor ON mentor.user_id = applicant.id AND mentor.deleted_at IS NULL
  LEFT JOIN mentor_profiles mentor_profile
    ON mentor_profile.mentor_id = mentor.id AND mentor_profile.deleted_at IS NULL
  LEFT JOIN file_assets cv ON cv.id = application.cv_asset_id`;

interface ApplicantRow {
  id: string;
  status: ApplicationStatus;
  created_at: Date;
  interview_at: Date | null;
  interview_url: string | null;
  decided_at: Date | null;
  user_id: string;
  mentor_id: string | null;
  name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  note: string | null;
  avatar_object_key: string | null;
  headline: string | null;
  experience_years: number | null;
  job_id: string;
  job_title: string;
  cv_filename: string;
  cv_size: string;
}

interface LockedApplication {
  id: string;
  status: ApplicationStatus;
  applicant_user_id: string;
  merchant_id: string;
  class_id: string | null;
}

@Injectable()
export class JobApplicationService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async apply(userId: string, jobId: string, input: ApplyJobDto) {
    let applicationId: string;
    try {
      applicationId = await this.dataSource.transaction(async (manager) => {
        // The share lock holds off a concurrent close until this commits.
        const [job] = await manager.query(
          `SELECT job.id, merchant.user_id AS owner_user_id
           FROM job_postings job
           INNER JOIN merchants merchant ON merchant.id = job.merchant_id
           WHERE job.id = $1 AND ${PUBLIC_JOB_SQL}
           FOR SHARE OF job`,
          [jobId],
        );
        if (!job) throw new NotFoundException('Job posting not found');
        if (job.owner_user_id === userId) {
          throw new BadRequestException(
            'You cannot apply to your own job posting',
          );
        }
        await assertOwnedAsset(
          manager,
          userId,
          input.cv_asset_id,
          'application_cv',
        );
        const application = await manager.save(
          manager.create(JobApplication, {
            jobPostingId: jobId,
            applicantUserId: userId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            linkedinUrl: input.linkedin_url,
            cvAssetId: input.cv_asset_id,
            note: input.note ?? null,
            status: 'review',
          }),
        );
        await queueApplicationEmail(manager, application.id, {
          type: 'submitted',
        });
        return application.id;
      });
    } catch (error) {
      // A second application to the same job, concurrent or not, fails on
      // the unique index.
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already applied to this job');
      }
      throw error;
    }

    const [data] = await this.findMyApplicationRows(userId, {
      applicationId,
    });
    return { data, responseMessage: 'Apply job success' };
  }

  async findMine(userId: string, query: MyApplicationQueryDto) {
    const { page, limit } = query;
    const [applications, [counts], [{ total }]] = await Promise.all([
      this.findMyApplicationRows(userId, {
        status: query.status,
        page,
        limit,
      }),
      this.dataSource.query(
        `SELECT ${COUNTS_SQL} FROM job_applications application
         WHERE application.applicant_user_id = $1 AND application.deleted_at IS NULL`,
        [userId],
      ) as Promise<ApplicationCountsDto[]>,
      this.dataSource.query(
        `SELECT count(*)::integer AS total FROM job_applications application
         WHERE application.applicant_user_id = $1 AND application.deleted_at IS NULL
           AND ($2::varchar IS NULL OR application.status = $2)`,
        [userId, query.status ?? null],
      ),
    ]);
    return {
      data: { counts, applications },
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get my applications success',
    };
  }

  async findApplicants(userId: string, query: ApplicantQueryDto) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const { page, limit } = query;
    const filters = [
      'job.merchant_id = $1',
      'job.deleted_at IS NULL',
      'application.deleted_at IS NULL',
      'applicant.deleted_at IS NULL',
    ];
    const params: unknown[] = [merchant.id];
    if (query.job_id) {
      params.push(query.job_id);
      filters.push(`job.id = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${escapeLike(query.search)}%`);
      const search = `$${params.length}`;
      filters.push(`(application.name ILIKE ${search} OR application.email ILIKE ${search}
        OR job.title ILIKE ${search})`);
    }
    const where = filters.join(' AND ');
    // Counts follow the vacancy and search filters but not the status filter,
    // so every status option can show its number.
    const statusParams = [...params, query.status ?? null];
    const statusFilter = `($${statusParams.length}::varchar IS NULL OR application.status = $${statusParams.length})`;
    const countFrom = `FROM job_applications application
      INNER JOIN job_postings job ON job.id = application.job_posting_id
      INNER JOIN users applicant ON applicant.id = application.applicant_user_id
      WHERE ${where}`;

    const [rows, [counts], [{ total }]] = await Promise.all([
      this.dataSource.query(
        `SELECT ${APPLICANT_COLUMNS_SQL} ${APPLICANT_JOINS_SQL}
         WHERE ${where} AND ${statusFilter}
         ORDER BY application.created_at DESC, application.id DESC
         LIMIT $${statusParams.length + 1} OFFSET $${statusParams.length + 2}`,
        [...statusParams, limit, (page - 1) * limit],
      ) as Promise<ApplicantRow[]>,
      this.dataSource.query(
        `SELECT ${COUNTS_SQL} ${countFrom}`,
        params,
      ) as Promise<ApplicationCountsDto[]>,
      this.dataSource.query(
        `SELECT count(*)::integer AS total ${countFrom} AND ${statusFilter}`,
        statusParams,
      ),
    ]);
    return {
      data: { counts, applicants: rows.map(toApplicant) },
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get applicants success',
    };
  }

  async findApplicantCv(userId: string, applicationId: string) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const [row] = await this.dataSource.query(
      `SELECT cv.object_key, cv.original_filename
       FROM job_applications application
       INNER JOIN job_postings job
         ON job.id = application.job_posting_id AND job.deleted_at IS NULL
       INNER JOIN file_assets cv ON cv.id = application.cv_asset_id AND cv.deleted_at IS NULL
       WHERE application.id = $1 AND application.deleted_at IS NULL AND job.merchant_id = $2`,
      [applicationId, merchant.id],
    );
    if (!row) throw new NotFoundException('Application not found');
    return {
      data: {
        filename: row.original_filename,
        download_url: await signedDownloadUrl(
          this.storage,
          row.object_key,
          row.original_filename,
        ),
      },
      responseMessage: 'Get applicant CV success',
    };
  }

  async scheduleInterview(
    userId: string,
    applicationId: string,
    input: ScheduleInterviewDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const application = await this.lockOwnApplication(
        manager,
        userId,
        applicationId,
        'interview',
      );
      await manager.update(
        JobApplication,
        { id: application.id },
        {
          status: 'interview',
          interviewAt: new Date(input.interview_at),
          interviewUrl: input.interview_url,
        },
      );
      await queueApplicationEmail(manager, application.id, {
        type: 'interview',
        interviewAt: input.interview_at,
        interviewUrl: input.interview_url,
        rescheduled: application.status === 'interview',
      });
    });
    return this.findApplicantResponse(
      userId,
      applicationId,
      'Schedule interview success',
    );
  }

  async reject(userId: string, applicationId: string) {
    await this.dataSource.transaction(async (manager) => {
      const application = await this.lockOwnApplication(
        manager,
        userId,
        applicationId,
        'reject',
      );
      await manager.update(
        JobApplication,
        { id: application.id },
        { status: 'rejected', decidedAt: new Date() },
      );
      await queueApplicationEmail(manager, application.id, {
        type: 'rejected',
      });
    });
    return this.findApplicantResponse(
      userId,
      applicationId,
      'Reject applicant success',
    );
  }

  // Acceptance makes the applicant a mentor of the merchant, and a tutor of
  // the vacancy's class when it has one, in one transaction.
  async accept(userId: string, applicationId: string) {
    await this.dataSource.transaction(async (manager) => {
      const application = await this.lockOwnApplication(
        manager,
        userId,
        applicationId,
        'accept',
      );
      const mentor = await this.grantMentorRole(
        manager,
        application.applicant_user_id,
      );
      await this.addToMerchantMentors(
        manager,
        application.merchant_id,
        application.applicant_user_id,
      );
      if (application.class_id) {
        await this.addClassTutor(
          manager,
          application.class_id,
          mentor.id,
          userId,
        );
      }
      await manager.update(
        JobApplication,
        { id: application.id },
        { status: 'accepted', decidedAt: new Date() },
      );
      await queueApplicationEmail(manager, application.id, {
        type: 'accepted',
      });
    });
    return this.findApplicantResponse(
      userId,
      applicationId,
      'Accept applicant success',
    );
  }

  private async lockOwnApplication(
    manager: EntityManager,
    userId: string,
    applicationId: string,
    action: keyof typeof ALLOWED_FROM,
  ): Promise<LockedApplication> {
    const merchant = await findOwnMerchant(manager, userId);
    const [application]: LockedApplication[] = await manager.query(
      `SELECT application.id, application.status, application.applicant_user_id,
              job.merchant_id, job.class_id
       FROM job_applications application
       INNER JOIN job_postings job
         ON job.id = application.job_posting_id AND job.deleted_at IS NULL
       WHERE application.id = $1 AND application.deleted_at IS NULL AND job.merchant_id = $2
       FOR UPDATE OF application`,
      [applicationId, merchant.id],
    );
    if (!application) throw new NotFoundException('Application not found');
    if (!ALLOWED_FROM[action].includes(application.status)) {
      throw new BadRequestException(
        `Cannot ${action === 'interview' ? 'schedule an interview for' : action} an application that is ${application.status}`,
      );
    }
    return application;
  }

  // Registration may complete the mentor profile later; the account lock
  // keeps a concurrent registration from creating a second mentor record.
  private async grantMentorRole(
    manager: EntityManager,
    applicantUserId: string,
  ): Promise<Mentor> {
    const user = await manager.findOne(User, {
      where: { id: applicantUserId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) {
      throw new ConflictException('The applicant account no longer exists');
    }

    let mentor = await manager.findOne(Mentor, {
      where: { userId: applicantUserId },
      withDeleted: true,
    });
    if (mentor && (mentor.deleted_at || mentor.status !== 'active')) {
      throw new ConflictException('The applicant mentor account is not active');
    }
    if (!mentor) {
      mentor = await manager.save(
        manager.create(Mentor, { userId: applicantUserId, status: 'active' }),
      );
    }
    if (!user.isMentor) {
      await manager.update(User, { id: user.id }, { isMentor: true });
    }
    return mentor;
  }

  private async addToMerchantMentors(
    manager: EntityManager,
    merchantId: string,
    mentorUserId: string,
  ): Promise<void> {
    const entry = await manager.findOne(MerchantMentor, {
      where: { merchantId, mentorUserId },
      withDeleted: true,
    });
    if (!entry) {
      await manager.save(
        manager.create(MerchantMentor, {
          merchantId,
          mentorUserId,
          status: 'active',
          joinedAt: new Date(),
        }),
      );
      return;
    }
    if (entry.status === 'active' && !entry.deleted_at) return;
    await manager.update(
      MerchantMentor,
      { id: entry.id },
      {
        status: 'active',
        joinedAt: new Date(),
        endedAt: null,
        deleted_at: null,
      },
    );
  }

  // The class row lock serializes with tutor invites so the applicant is not
  // linked twice.
  private async addClassTutor(
    manager: EntityManager,
    classId: string,
    mentorId: string,
    ownerUserId: string,
  ): Promise<void> {
    const [cls] = await manager.query(
      `SELECT id FROM classes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [classId],
    );
    if (!cls) return;
    const linked = await manager.findOne(ClassMentor, {
      where: { class_id: classId, mentor_id: mentorId },
    });
    if (linked) return;
    await manager.save(
      manager.create(ClassMentor, {
        class_id: classId,
        mentor_id: mentorId,
        role: 'assistant',
        permissions: DEFAULT_TUTOR_PERMISSIONS.assistant,
        created_by: ownerUserId,
      }),
    );
  }

  private async findApplicantResponse(
    userId: string,
    applicationId: string,
    responseMessage: string,
  ) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const [row]: ApplicantRow[] = await this.dataSource.query(
      `SELECT ${APPLICANT_COLUMNS_SQL} ${APPLICANT_JOINS_SQL}
       WHERE application.id = $1 AND job.merchant_id = $2`,
      [applicationId, merchant.id],
    );
    return { data: toApplicant(row), responseMessage };
  }

  private findMyApplicationRows(
    userId: string,
    filter: {
      applicationId?: string;
      status?: ApplicationStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<MyApplicationResponseDto[]> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 1;
    return this.dataSource
      .query(
        `SELECT application.id, application.status, application.created_at,
                application.interview_at, application.interview_url, application.decided_at,
                job.id AS job_id, job.title AS job_title, job.category AS job_category,
                merchant.id AS merchant_id, merchant.store_name AS merchant_name,
                merchant_profile.slug AS merchant_slug, logo.object_key AS merchant_logo_key,
                class.id AS class_id, class.title AS class_title
         FROM job_applications application
         INNER JOIN job_postings job ON job.id = application.job_posting_id
         INNER JOIN merchants merchant ON merchant.id = job.merchant_id
         LEFT JOIN merchant_profiles merchant_profile
           ON merchant_profile.merchant_id = merchant.id AND merchant_profile.deleted_at IS NULL
         LEFT JOIN file_assets logo
           ON logo.id = merchant_profile.avatar_asset_id AND logo.deleted_at IS NULL
         LEFT JOIN classes class ON class.id = job.class_id AND class.deleted_at IS NULL
         WHERE application.applicant_user_id = $1 AND application.deleted_at IS NULL
           AND ($2::uuid IS NULL OR application.id = $2)
           AND ($3::varchar IS NULL OR application.status = $3)
         ORDER BY application.created_at DESC, application.id DESC
         LIMIT $4 OFFSET $5`,
        [
          userId,
          filter.applicationId ?? null,
          filter.status ?? null,
          limit,
          (page - 1) * limit,
        ],
      )
      .then((rows) =>
        rows.map(
          (row): MyApplicationResponseDto => ({
            id: row.id,
            status: row.status,
            created_at: row.created_at,
            interview_at: row.interview_at,
            interview_url: row.interview_url,
            decided_at: row.decided_at,
            job: {
              id: row.job_id,
              title: row.job_title,
              category: row.job_category,
            },
            merchant: {
              id: row.merchant_id,
              name: row.merchant_name,
              slug: row.merchant_slug,
              logo_url: assetUrl(row.merchant_logo_key),
            },
            class: row.class_id
              ? { id: row.class_id, title: row.class_title }
              : null,
          }),
        ),
      );
  }
}

function toApplicant(row: ApplicantRow): ApplicantResponseDto {
  return {
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    interview_at: row.interview_at,
    interview_url: row.interview_url,
    decided_at: row.decided_at,
    user_id: row.user_id,
    mentor_id: row.mentor_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    linkedin_url: row.linkedin_url,
    note: row.note,
    avatar_url: assetUrl(row.avatar_object_key),
    headline: row.headline,
    experience_years:
      row.experience_years === null ? null : Number(row.experience_years),
    job: { id: row.job_id, title: row.job_title },
    cv: { filename: row.cv_filename, size: Number(row.cv_size) },
  };
}
