import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SavedJobPosting } from './entities/saved-job-posting.entity';
import { JobPostingService } from './job-posting.service';

const userId = '10000000-0000-4000-8000-000000000001';
const jobA = '30000000-0000-4000-8000-00000000000a';
const jobB = '30000000-0000-4000-8000-00000000000b';
const savedAt = new Date('2026-10-02T03:00:00Z');

const jobRow = (id: string) => ({
  id,
  title: `Job ${id.slice(-1)}`,
  category: 'Teknik Sipil',
  contract_type: 'Part-Time',
  work_type: 'Remote',
  location: 'Remote',
  salary: 'Rp 5.000.000',
  requirements: 'x',
  skills: [],
  status: 'active',
  created_at: new Date(),
  closed_at: null,
  merchant_id: 'm',
  merchant_name: 'Toko',
  merchant_slug: 'toko',
  merchant_logo_key: null,
  class_id: null,
  class_title: null,
  applicants_count: 0,
  is_new: true,
});

describe('saved job postings', () => {
  let query: jest.Mock;
  let insert: { orUpdate: jest.Mock; returning: jest.Mock; execute: jest.Mock };
  let manager: { findOneBy: jest.Mock; delete: jest.Mock };
  let service: JobPostingService;
  let publicJobs: string[];
  let savedIds: string[];

  beforeEach(() => {
    publicJobs = [jobA, jobB];
    savedIds = [jobB];
    query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT job.id FROM job_postings job')) {
        return publicJobs.includes(params[0] as string)
          ? [{ id: params[0] }]
          : [];
      }
      if (sql.includes('SELECT job_posting_id FROM saved_job_postings')) {
        return savedIds.map((id) => ({ job_posting_id: id }));
      }
      if (sql.includes('saved.created_at AS saved_at')) {
        return [
          { job_posting_id: jobB, saved_at: savedAt, is_open: false },
          { job_posting_id: jobA, saved_at: savedAt, is_open: true },
        ];
      }
      if (sql.includes('count(*)::integer AS total FROM saved_job_postings')) {
        return [{ total: 2 }];
      }
      if (sql.includes('job.id = ANY')) return [jobRow(jobA), jobRow(jobB)];
      if (sql.includes('WHERE job.id = $1'))
        return [jobRow(params[0] as string)];
      return [];
    });
    insert = {
      orUpdate: jest.fn(),
      returning: jest.fn(),
      execute: jest.fn(async () => ({ raw: [{ created_at: savedAt }] })),
    };
    insert.orUpdate.mockReturnValue(insert);
    insert.returning.mockReturnValue(insert);
    const builder = {
      insert: () => builder,
      into: () => builder,
      values: jest.fn(() => insert),
    };
    manager = {
      findOneBy: jest.fn(async () => ({ created_at: savedAt })),
      delete: jest.fn(),
    };
    service = new JobPostingService({
      query,
      manager,
      createQueryBuilder: () => builder,
    } as unknown as DataSource);
  });

  it('saves an active job idempotently and returns the save time', async () => {
    await expect(service.save(userId, jobA)).resolves.toMatchObject({
      data: { job_posting_id: jobA, is_saved: true, saved_at: savedAt },
    });
    expect(insert.orUpdate).toHaveBeenCalledWith(
      ['updated_at'],
      ['user_id', 'job_posting_id'],
      { indexPredicate: 'deleted_at IS NULL' },
    );
  });

  it('refuses to save a job that is not on the public board', async () => {
    publicJobs = [];
    await expect(service.save(userId, jobA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(insert.execute).not.toHaveBeenCalled();
  });

  it('unsaves by deleting the row, even when nothing was saved', async () => {
    await expect(service.unsave(userId, jobA)).resolves.toMatchObject({
      data: { job_posting_id: jobA, is_saved: false, saved_at: null },
    });
    expect(manager.delete).toHaveBeenCalledWith(SavedJobPosting, {
      userId,
      jobPostingId: jobA,
    });
  });

  it('lists saved jobs in save order with is_open and is_saved', async () => {
    const response = await service.findSaved(userId, { page: 1, limit: 10 });
    expect(
      response.data.map((job) => [job.id, job.is_open, job.is_saved]),
    ).toEqual([
      [jobB, false, true],
      [jobA, true, true],
    ]);
    expect(response.data[0].saved_at).toBe(savedAt);
    expect(response.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      total_page: 1,
    });
  });

  it('marks is_saved on the public detail for the caller only', async () => {
    await expect(service.findPublicOne(jobB, userId)).resolves.toMatchObject({
      data: { is_saved: true },
    });
    await expect(service.findPublicOne(jobB)).resolves.toMatchObject({
      data: { is_saved: false },
    });
    const savedLookups = query.mock.calls.filter(([sql]) =>
      sql.includes('SELECT job_posting_id FROM saved_job_postings'),
    );
    expect(savedLookups).toHaveLength(1);
  });
});
