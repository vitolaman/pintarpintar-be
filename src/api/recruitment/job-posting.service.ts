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
      data: await this.findResponse(jobId),
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
    return {
      data: rows.map(toJobResponse),
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
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
    return {
      data: toJobResponse(row),
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
      data: await this.findResponse(jobId),
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
      data: await this.findResponse(jobId),
      responseMessage: 'Close job posting success',
    };
  }

  async findPublic(query: PublicJobQueryDto) {
    const { page, limit } = query;
    const conditions = [PUBLIC_JOB_SQL];
    const params: unknown[] = [];
    if (query.keyword) {
      params.push(`%${escapeLike(query.keyword)}%`);
      const keyword = `$${params.length}`;
      conditions.push(`(job.title ILIKE ${keyword} OR merchant.store_name ILIKE ${keyword}
        OR job.category ILIKE ${keyword} OR array_to_string(job.skills, ' ') ILIKE ${keyword})`);
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
    return {
      data: {
        active_jobs: totals.active_jobs,
        recruiting_merchants: totals.recruiting_merchants,
        jobs: rows.map(toJobResponse),
      },
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
      responseMessage: 'Get job board success',
    };
  }

  async findPublicOne(jobId: string) {
    const [row]: JobRow[] = await this.dataSource.query(
      `${JOB_SELECT_SQL} WHERE job.id = $1 AND ${PUBLIC_JOB_SQL}`,
      [jobId],
    );
    if (!row) throw new NotFoundException('Job posting not found');
    return { data: toJobResponse(row), responseMessage: 'Get job success' };
  }

  private async findResponse(jobId: string): Promise<JobPostingResponseDto> {
    const [row]: JobRow[] = await this.dataSource.query(
      `${JOB_SELECT_SQL} WHERE job.id = $1`,
      [jobId],
    );
    return toJobResponse(row);
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

function toJobResponse(row: JobRow): JobPostingResponseDto {
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
  };
}
