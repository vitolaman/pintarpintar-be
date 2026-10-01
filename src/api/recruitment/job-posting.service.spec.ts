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
  category: 'Desain Teknik & Arsitektur',
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
    [{ category: 'Coding' }, ['category']],
    [{ contract_type: 'Freelance' }, ['contract_type']],
    [{ work_type: 'Office' }, ['work_type']],
    [{ title: '  ' }, ['title']],
    [{ salary: 'x'.repeat(101) }, ['salary']],
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

  it("hides another merchant's vacancy", async () => {
    job = null;
    await expect(
      service.update(userId, jobId, { title: 'Baru' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
