import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { assetUrl } from '~/common/storage/asset-url';
import { escapeLike } from '~/common/util/escape-like';
import {
  CreateJobPostingDto,
  JobPostingResponseDto,
  PublicJobQueryDto,
  UpdateJobPostingDto,
} from './dto/job-posting.dto';
import { JobPosting } from './entities/job-posting.entity';
import { NEW_JOB_DAYS } from './recruitment.constants';
import { findOwnMerchant } from './recruitment-merchant';
import { PUBLIC_JOB_SQL } from './recruitment-sql';
import { SavedJobPosting } from './entities/saved-job-posting.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';

// Applications of deleted accounts are not counted anywhere.
const JOB_SELECT_SQL = `
  SELECT job.id, job.title, job.category, job.contract_type, job.work_type,
         job.location, job.salary, job.requirements, job.skills, job.status,
         job.created_at, job.closed_at,
         merchant.id AS merchant_id, merchant.store_name AS merchant_name,
         profile.slug AS merchant_slug, logo.object_key AS merchant_logo_key,
         class.id AS class_id, class.title AS class_title,
         (SELECT count(*)::integer FROM job_applications application
            INNER JOIN users applicant
              ON applicant.id = application.applicant_user_id AND applicant.deleted_at IS NULL
            WHERE application.job_posting_id = job.id AND application.deleted_at IS NULL
         ) AS applicants_count,
         job.created_at > now() - interval '${NEW_JOB_DAYS} days' AS is_new
  FROM job_postings job
  INNER JOIN merchants merchant ON merchant.id = job.merchant_id
  LEFT JOIN merchant_profiles profile
    ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets logo ON logo.id = profile.avatar_asset_id AND logo.deleted_at IS NULL
  LEFT JOIN classes class ON class.id = job.class_id AND class.deleted_at IS NULL`;

interface JobRow {
  id: string;
  title: string;
  category: JobPostingResponseDto['category'];
  contract_type: JobPostingResponseDto['contract_type'];
  work_type: JobPostingResponseDto['work_type'];
  location: string;
  salary: string;
  requirements: string;
  skills: string[];
  status: JobPostingResponseDto['status'];
  created_at: Date;
  closed_at: Date | null;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string | null;
  merchant_logo_key: string | null;
  class_id: string | null;
  class_title: string | null;
  applicants_count: number;
  is_new: boolean;
}

@Injectable()
export class JobPostingService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, input: CreateJobPostingDto) {
    const jobId = await this.dataSource.transaction(async (manager) => {
      const merchant = await findOwnMerchant(manager, userId, {
        requireActive: true,
      });
      if (input.class_id) {
        await this.assertOwnClass(manager, merchant.id, input.class_id);
      }
      const job = await manager.save(
        manager.create(JobPosting, {
          merchantId: merchant.id,
          classId: input.class_id ?? null,
          title: input.title,
          category: input.category,
          contractType: input.contract_type,
          workType: input.work_type,
          location: input.location,
          salary: input.salary,
          requirements: input.requirements,
          skills: input.skills ?? [],
          status: 'active',
        }),
      );
      return job.id;
    });
    return {
      data: await this.findResponse(jobId, userId),
      responseMessage: 'Create job posting success',
    };
  }

  async findMine(userId: string, query: RequestPaginatedQueryDto) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const { page, limit } = query;
    const [rows, [{ total }]] = await Promise.all([
      this.dataSource.query(
        `${JOB_SELECT_SQL}
         WHERE job.merchant_id = $1 AND job.deleted_at IS NULL AND job.status = 'active'
         ORDER BY job.created_at DESC, job.id DESC
         LIMIT $2 OFFSET $3`,
        [merchant.id, limit, (page - 1) * limit],
      ) as Promise<JobRow[]>,
      this.dataSource.query(
        `SELECT count(*)::integer AS total FROM job_postings job
         WHERE job.merchant_id = $1 AND job.deleted_at IS NULL AND job.status = 'active'`,
        [merchant.id],
      ),
    ]);
    const saved = await this.savedJobIds(userId, rows);
    return {
      data: rows.map((row) => toJobResponse(row, saved.has(row.id))),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get job postings success',
    };
  }

  async findMineOne(userId: string, jobId: string) {
    const merchant = await findOwnMerchant(this.dataSource.manager, userId);
    const [row]: JobRow[] = await this.dataSource.query(
      `${JOB_SELECT_SQL}
       WHERE job.id = $1 AND job.merchant_id = $2 AND job.deleted_at IS NULL`,
      [jobId, merchant.id],
    );
    if (!row) throw new NotFoundException('Job posting not found');
    const saved = await this.savedJobIds(userId, [row]);
    return {
      data: toJobResponse(row, saved.has(row.id)),
      responseMessage: 'Get job posting success',
    };
  }

  async update(userId: string, jobId: string, input: UpdateJobPostingDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await findOwnMerchant(manager, userId, {
        requireActive: true,
      });
      const job = await this.lockOwnJob(manager, merchant.id, jobId);
      if (job.status === 'closed') {
        throw new BadRequestException('A closed job posting cannot be edited');
      }
      if (input.class_id) {
        await this.assertOwnClass(manager, merchant.id, input.class_id);
      }

      if (input.title !== undefined) job.title = input.title;
      if (input.category !== undefined) job.category = input.category;
      if (input.contract_type !== undefined) {
        job.contractType = input.contract_type;
      }
      if (input.work_type !== undefined) job.workType = input.work_type;
      if (input.location !== undefined) job.location = input.location;
      if (input.salary !== undefined) job.salary = input.salary;
      if (input.requirements !== undefined) {
        job.requirements = input.requirements;
      }
      if (input.skills !== undefined) job.skills = input.skills;
      if (input.class_id !== undefined) job.classId = input.class_id;
      await manager.save(job);
    });
    return {
      data: await this.findResponse(jobId, userId),
      responseMessage: 'Update job posting success',
    };
  }

  // Closing is permanent and keeps the applications; closing again changes
  // nothing.
  async close(userId: string, jobId: string) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await findOwnMerchant(manager, userId);
      const job = await this.lockOwnJob(manager, merchant.id, jobId);
      if (job.status === 'closed') return;
      job.status = 'closed';
      job.closedAt = new Date();
      await manager.save(job);
    });
    return {
      data: await this.findResponse(jobId, userId),
      responseMessage: 'Close job posting success',
    };
  }

  async findPublic(query: PublicJobQueryDto, viewerId?: string) {
    const { page, limit } = query;
    const conditions = [PUBLIC_JOB_SQL];
    const params: unknown[] = [];
    if (query.search) {
      params.push(`%${escapeLike(query.search)}%`);
      const search = `$${params.length}`;
      conditions.push(`(job.title ILIKE ${search} OR merchant.store_name ILIKE ${search}
        OR job.category ILIKE ${search} OR array_to_string(job.skills, ' ') ILIKE ${search})`);
    }
    if (query.location) {
      params.push(`%${escapeLike(query.location)}%`);
      conditions.push(`job.location ILIKE $${params.length}`);
    }
    if (query.category) {
      params.push(query.category);
      conditions.push(`job.category = $${params.length}`);
    }
    if (query.contract_type) {
      params.push(query.contract_type);
      conditions.push(`job.contract_type = $${params.length}`);
    }
    if (query.work_type) {
      params.push(query.work_type);
      conditions.push(`job.work_type = $${params.length}`);
    }
    const where = conditions.join(' AND ');

    const [rows, [{ total }], [totals]] = await Promise.all([
      this.dataSource.query(
        `${JOB_SELECT_SQL}
         WHERE ${where}
         ORDER BY job.created_at DESC, job.id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit],
      ) as Promise<JobRow[]>,
      this.dataSource.query(
        `SELECT count(*)::integer AS total FROM job_postings job
         INNER JOIN merchants merchant ON merchant.id = job.merchant_id
         WHERE ${where}`,
        params,
      ),
      this.dataSource.query(
        `SELECT count(*)::integer AS active_jobs,
                count(DISTINCT job.merchant_id)::integer AS recruiting_merchants
         FROM job_postings job
         INNER JOIN merchants merchant ON merchant.id = job.merchant_id
         WHERE ${PUBLIC_JOB_SQL}`,
      ),
    ]);
    const saved = await this.savedJobIds(viewerId, rows);
    return {
      data: {
        active_jobs: totals.active_jobs,
        recruiting_merchants: totals.recruiting_merchants,
        jobs: rows.map((row) => toJobResponse(row, saved.has(row.id))),
      },
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get job board success',
    };
  }

  async findPublicOne(jobId: string, viewerId?: string) {
    const [row]: JobRow[] = await this.dataSource.query(
      `${JOB_SELECT_SQL} WHERE job.id = $1 AND ${PUBLIC_JOB_SQL}`,
      [jobId],
    );
    if (!row) throw new NotFoundException('Job posting not found');
    const saved = await this.savedJobIds(viewerId, [row]);
    return {
      data: toJobResponse(row, saved.has(row.id)),
      responseMessage: 'Get job success',
    };
  }

  /** Saves an active job for the caller; saving it again changes nothing. */
  async save(userId: string, jobId: string) {
    const [job] = await this.dataSource.query(
      `SELECT job.id FROM job_postings job
       INNER JOIN merchants merchant ON merchant.id = job.merchant_id
       WHERE job.id = $1 AND ${PUBLIC_JOB_SQL}`,
      [jobId],
    );
    if (!job) throw new NotFoundException('Job posting not found');

    // One atomic upsert on the per-user unique index: a repeated or
    // concurrent save keeps the single row, and RETURNING gives its save time
    // even if an unsave runs right after.
    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(SavedJobPosting)
      .values({ userId, jobPostingId: jobId })
      .orUpdate(['updated_at'], ['user_id', 'job_posting_id'], {
        indexPredicate: 'deleted_at IS NULL',
      })
      .returning(['created_at'])
      .execute();
    const [saved] = result.raw as { created_at: Date }[];
    return {
      data: {
        job_posting_id: jobId,
        is_saved: true,
        saved_at: saved.created_at,
      },
      responseMessage: 'Save job posting success',
    };
  }

  /** Removes a saved job; unsaving one that is not saved also succeeds. */
  async unsave(userId: string, jobId: string) {
    await this.dataSource.manager.delete(SavedJobPosting, {
      userId,
      jobPostingId: jobId,
    });
    return {
      data: { job_posting_id: jobId, is_saved: false, saved_at: null },
      responseMessage: 'Unsave job posting success',
    };
  }

  /**
   * The caller's saved jobs, newest save first. Jobs closed or removed after
   * saving stay listed with is_open false until the caller unsaves them.
   */
  async findSaved(userId: string, query: RequestPaginatedQueryDto) {
    const { page, limit } = query;
    const [savedRows, [{ total }]] = await Promise.all([
      this.dataSource.query(
        `SELECT saved.job_posting_id, saved.created_at AS saved_at,
                (${PUBLIC_JOB_SQL}) AS is_open
         FROM saved_job_postings saved
         INNER JOIN job_postings job ON job.id = saved.job_posting_id
         INNER JOIN merchants merchant ON merchant.id = job.merchant_id
         WHERE saved.user_id = $1 AND saved.deleted_at IS NULL
         ORDER BY saved.created_at DESC, saved.id DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, (page - 1) * limit],
      ) as Promise<
        { job_posting_id: string; saved_at: Date; is_open: boolean }[]
      >,
      this.dataSource.query(
        `SELECT count(*)::integer AS total FROM saved_job_postings saved
         INNER JOIN job_postings job ON job.id = saved.job_posting_id
         WHERE saved.user_id = $1 AND saved.deleted_at IS NULL`,
        [userId],
      ),
    ]);
    const ids = savedRows.map((row) => row.job_posting_id);
    const jobs: JobRow[] =
      ids.length === 0
        ? []
        : await this.dataSource.query(
            `${JOB_SELECT_SQL} WHERE job.id = ANY($1::uuid[])`,
            [ids],
          );
    const byId = new Map(jobs.map((job) => [job.id, job]));
    return {
      data: savedRows.map((saved) => ({
        ...toJobResponse(byId.get(saved.job_posting_id), true),
        saved_at: saved.saved_at,
        is_open: saved.is_open,
      })),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get saved job postings success',
    };
  }

  private async savedJobIds(
    viewerId: string | null | undefined,
    rows: { id: string }[],
  ): Promise<Set<string>> {
    if (!viewerId || rows.length === 0) return new Set();
    const saved: { job_posting_id: string }[] = await this.dataSource.query(
      `SELECT job_posting_id FROM saved_job_postings
       WHERE user_id = $1 AND job_posting_id = ANY($2::uuid[]) AND deleted_at IS NULL`,
      [viewerId, rows.map((row) => row.id)],
    );
    return new Set(saved.map((row) => row.job_posting_id));
  }

  private async findResponse(
    jobId: string,
    viewerId: string,
  ): Promise<JobPostingResponseDto> {
    const [row]: JobRow[] = await this.dataSource.query(
      `${JOB_SELECT_SQL} WHERE job.id = $1`,
      [jobId],
    );
    const saved = await this.savedJobIds(viewerId, [row]);
    return toJobResponse(row, saved.has(row.id));
  }

  private async lockOwnJob(
    manager: EntityManager,
    merchantId: string,
    jobId: string,
  ): Promise<JobPosting> {
    const job = await manager.findOne(JobPosting, {
      where: { id: jobId, merchantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!job) throw new NotFoundException('Job posting not found');
    return job;
  }

  private async assertOwnClass(
    manager: EntityManager,
    merchantId: string,
    classId: string,
  ): Promise<void> {
    const [owned] = await manager.query(
      `SELECT 1 FROM classes WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL`,
      [classId, merchantId],
    );
    if (!owned) {
      throw new BadRequestException('class_id must be one of your classes');
    }
  }
}

function toJobResponse(row: JobRow, isSaved = false): JobPostingResponseDto {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    contract_type: row.contract_type,
    work_type: row.work_type,
    location: row.location,
    salary: row.salary,
    requirements: row.requirements,
    skills: row.skills,
    status: row.status,
    merchant: {
      id: row.merchant_id,
      name: row.merchant_name,
      slug: row.merchant_slug,
      logo_url: assetUrl(row.merchant_logo_key),
    },
    class: row.class_id ? { id: row.class_id, title: row.class_title } : null,
    applicants_count: row.applicants_count,
    is_new: row.is_new,
    created_at: row.created_at,
    closed_at: row.closed_at,
    is_saved: isSaved,
  };
}
