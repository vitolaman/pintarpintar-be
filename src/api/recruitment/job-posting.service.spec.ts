import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  CreateJobPostingDto,
  PublicJobQueryDto,
  UpdateJobPostingDto,
} from './dto/job-posting.dto';
import { JobPosting } from './entities/job-posting.entity';
import { JobPostingService } from './job-posting.service';

const userId = '10000000-0000-4000-8000-000000000001';
const merchantId = '20000000-0000-4000-8000-000000000001';
const jobId = '30000000-0000-4000-8000-000000000001';
const classId = '40000000-0000-4000-8000-000000000001';

const input: CreateJobPostingDto = {
  title: 'Instruktur AutoCAD',
  category: 'Teknik Sipil',
  contract_type: 'Part-Time',
  work_type: 'Remote',
  location: 'Full Remote',
  salary: 'Rp 5.000.000 / bulan',
  requirements: 'Minimal 3 tahun pengalaman.',
};

async function errorFields(target: new () => object, value: object) {
  const errors = await validate(plainToInstance(target, value));
  return errors.map((error) => error.property);
}

describe('job posting DTOs', () => {
  it('normalizes skills', () => {
    const dto = plainToInstance(CreateJobPostingDto, {
      ...input,
      skills: [' AutoCAD ', 'autocad', '', 'BIM'],
    });
    expect(dto.skills).toEqual(['AutoCAD', 'BIM']);
  });

  it.each([
    [{}, []],
    [{ category: 'Coding' }, []],
    [{ category: '  ' }, ['category']],
    [{ category: 'x'.repeat(65) }, ['category']],
    [{ contract_type: 'Freelance' }, ['contract_type']],
    [{ work_type: 'Office' }, ['work_type']],
    [{ title: '  ' }, ['title']],
    [{ salary: 'x'.repeat(101) }, ['salary']],
    [{ location: 'x'.repeat(151) }, ['location']],
    [{ location: undefined, salary: undefined }, []],
    [
      {
        skills: Array(21)
          .fill('a')
          .map((a, i) => a + i),
      },
      ['skills'],
    ],
    [{ skills: ['x'.repeat(51)] }, ['skills']],
    [{ class_id: 'class' }, ['class_id']],
    [{ class_id: null }, []],
  ])('validates a new vacancy %j', async (value, fields) => {
    expect(
      await errorFields(CreateJobPostingDto, { ...input, ...value }),
    ).toEqual(fields);
  });

  it.each([
    [{ class_id: null }, []],
    [{ skills: [] }, []],
    [{ title: null }, ['title']],
    [{ skills: null }, ['skills']],
    [{ category: null }, ['category']],
  ])('validates a vacancy update %j', async (value, fields) => {
    expect(await errorFields(UpdateJobPostingDto, value)).toEqual(fields);
  });

  it('rejects an unknown board filter', async () => {
    expect(
      await errorFields(PublicJobQueryDto, { work_type: 'Office' }),
    ).toEqual(['work_type']);
  });

  it('matches enums ignoring case and keeps the category label as sent', async () => {
    const dto = plainToInstance(CreateJobPostingDto, {
      ...input,
      category: ' Lifestyle & Hobi ',
      contract_type: 'part-time',
      work_type: 'ON-SITE',
    });
    expect(dto).toMatchObject({
      category: 'Lifestyle & Hobi',
      contract_type: 'Part-Time',
      work_type: 'On-Site',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([[''], ['  '], [null]])(
    'clears location and salary given %j on create and update',
    async (value) => {
      const created = plainToInstance(CreateJobPostingDto, {
        ...input,
        location: value,
        salary: value,
      });
      expect(created).toMatchObject({ location: null, salary: null });
      expect(await validate(created)).toEqual([]);
      const updated = plainToInstance(UpdateJobPostingDto, {
        location: value,
        salary: value,
      });
      expect(updated).toMatchObject({ location: null, salary: null });
      expect(await validate(updated)).toEqual([]);
    },
  );

  it.each([[''], ['  '], [null]])(
    'rejects a required text of %j on create and update',
    async (requirements) => {
      expect(
        await errorFields(CreateJobPostingDto, { ...input, requirements }),
      ).toEqual(['requirements']);
      expect(await errorFields(UpdateJobPostingDto, { requirements })).toEqual([
        'requirements',
      ]);
    },
  );

  it('treats blank board filters as no filter', async () => {
    const query = plainToInstance(PublicJobQueryDto, {
      search: '',
      location: '  ',
      category: '',
      contract_type: ' ',
      work_type: '',
    });
    expect(query).toMatchObject({
      search: undefined,
      location: undefined,
      category: undefined,
      contract_type: undefined,
      work_type: undefined,
    });
    expect(await validate(query)).toEqual([]);
  });

  it('rejects the old keyword filter', async () => {
    const errors = await validate(
      plainToInstance(PublicJobQueryDto, { keyword: 'autocad' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((error) => error.property)).toEqual(['keyword']);
  });

  it('matches board filters ignoring case', async () => {
    const query = plainToInstance(PublicJobQueryDto, {
      search: ' autocad ',
      work_type: 'hybrid',
      contract_type: 'FULL-TIME',
    });
    expect(query).toMatchObject({
      search: 'autocad',
      work_type: 'Hybrid',
      contract_type: 'Full-Time',
    });
    expect(await validate(query)).toEqual([]);
  });
});

describe('JobPostingService', () => {
  let manager: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;
  let service: JobPostingService;
  let merchant: Partial<Merchant> | null;
  let job: Partial<JobPosting> | null;

  beforeEach(() => {
    merchant = { id: merchantId, userId, status: 'active' };
    job = { id: jobId, merchantId, status: 'active', title: 'Lama' };
    manager = {
      findOne: jest.fn(async (target) =>
        target === Merchant ? merchant : job,
      ),
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (value) => ({ ...value, id: jobId })),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      query: jest.fn().mockResolvedValue([
        {
          id: jobId,
          skills: [],
          merchant_id: merchantId,
          merchant_name: 'Toko',
          class_id: null,
        },
      ]),
    };
    service = new JobPostingService(dataSource as unknown as DataSource);
  });

  it('publishes an active vacancy for an active merchant', async () => {
    await expect(service.create(userId, input)).resolves.toMatchObject({
      data: { id: jobId },
      responseMessage: 'Create job posting success',
    });
    expect(manager.create).toHaveBeenCalledWith(
      JobPosting,
      expect.objectContaining({ merchantId, status: 'active', skills: [] }),
    );
  });

  it('stores a vacancy without location and salary as null', async () => {
    await service.create(userId, {
      ...input,
      location: undefined,
      salary: undefined,
    });
    expect(manager.create).toHaveBeenCalledWith(
      JobPosting,
      expect.objectContaining({ location: null, salary: null }),
    );
  });

  it('clears the salary on update', async () => {
    job = { ...job, salary: 'Rp 1' };
    await service.update(userId, jobId, { salary: null });
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ salary: null }),
    );
  });

  it('forbids an inactive merchant', async () => {
    merchant = { ...merchant, status: 'inactive' };
    await expect(service.create(userId, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('needs a merchant', async () => {
    merchant = null;
    await expect(service.create(userId, input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a class of another merchant', async () => {
    manager.query.mockResolvedValue([]);
    await expect(
      service.create(userId, { ...input, class_id: classId }),
    ).rejects.toThrow('class_id must be one of your classes');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('does not edit a closed vacancy', async () => {
    job = { ...job, status: 'closed' };
    await expect(
      service.update(userId, jobId, { title: 'Baru' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('closes once and keeps a closed vacancy unchanged', async () => {
    await service.close(userId, jobId);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed', closedAt: expect.any(Date) }),
    );

    manager.save.mockClear();
    job = { ...job, status: 'closed' };
    await service.close(userId, jobId);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('searches the board by title, merchant, category and skills', async () => {
    dataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ active_jobs: 0, recruiting_merchants: 0 }]);

    await service.findPublic(
      plainToInstance(PublicJobQueryDto, { search: ' 50%_cad ' }),
    );

    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain(
      "job.title ILIKE $1 OR merchant.store_name ILIKE $1\n        OR job.category ILIKE $1 OR array_to_string(job.skills, ' ') ILIKE $1",
    );
    expect(params).toEqual(['%50\\%\\_cad%', 10, 0]);
  });

  it("hides another merchant's vacancy", async () => {
    job = null;
    await expect(
      service.update(userId, jobId, { title: 'Baru' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
