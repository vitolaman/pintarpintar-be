import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { ClassAccessService } from './class-access.service';
import {
  ClassDuplicationService,
  copyTitle,
} from './class-duplication.service';
import { ClassFaqController } from './class-faq.controller';
import { ClassFaqService } from './class-faq.service';
import { DEFAULT_TUTOR_PERMISSIONS } from './class-permissions';
import {
  CreateClassFaqDto,
  DuplicateClassDto,
  UpdateClassFaqDto,
} from './dto/class-faq.dto';
import { ClassFaq } from './entities/class-faq.entity';
import { ClassType } from './entities/class.entity';

const userId = '10000000-0000-4000-8000-000000000001';
const classId = '30000000-0000-4000-8000-000000000001';
const faqId = '70000000-0000-4000-8000-000000000001';

async function errorFields(target: new () => object, value: object) {
  const errors = await validate(plainToInstance(target, value));
  return errors.map((error) => error.property);
}

describe('class FAQ and duplication DTOs', () => {
  it.each([
    [CreateClassFaqDto, { question: 'Q?', answer: 'A.' }, []],
    [CreateClassFaqDto, { question: '  ', answer: 'A.' }, ['question']],
    [
      CreateClassFaqDto,
      { question: 'x'.repeat(301), answer: 'A.' },
      ['question'],
    ],
    [
      CreateClassFaqDto,
      { question: 'Q?', answer: 'x'.repeat(3001) },
      ['answer'],
    ],
    [CreateClassFaqDto, { question: 'Q?', answer: '' }, ['answer']],
    [UpdateClassFaqDto, { answer: null }, ['answer']],
    [UpdateClassFaqDto, { question: '' }, ['question']],
    [UpdateClassFaqDto, {}, []],
    [DuplicateClassDto, { type: 'kelas' }, []],
    [DuplicateClassDto, { type: ' Bootcamp ' }, []],
    [DuplicateClassDto, { type: 'video' }, ['type']],
    [DuplicateClassDto, { type: 'live-bootcamp' }, ['type']],
  ])('validates %p %j', async (target, value, fields) => {
    expect(await errorFields(target as never, value)).toEqual(fields);
  });

  it('trims FAQ text and stores the duplicate type canonically', () => {
    expect(
      plainToInstance(CreateClassFaqDto, { question: ' Q? ', answer: ' A. ' }),
    ).toMatchObject({ question: 'Q?', answer: 'A.' });
    expect(plainToInstance(DuplicateClassDto, { type: 'KELAS' }).type).toBe(
      'kelas',
    );
  });

  it.each([
    ['kelas', ClassType.VIDEO],
    ['bootcamp', ClassType.LIVE_BOOTCAMP],
  ] as const)('duplicates as kind %s', async (kind, stored) => {
    const duplication = { duplicate: jest.fn() };
    const controller = new ClassFaqController(
      {} as never,
      duplication as never,
    );

    await controller.duplicate({ user: { id: 'user-id' } }, 'class-id', {
      type: kind,
    });

    expect(duplication.duplicate).toHaveBeenCalledWith(
      'user-id',
      'class-id',
      stored,
    );
  });

  it('keeps the copy title within 255 characters', () => {
    expect(copyTitle('AutoCAD Dasar')).toBe('AutoCAD Dasar (Salinan)');
    const long = copyTitle('x'.repeat(255));
    expect(long).toHaveLength(255);
    expect(long.endsWith(' (Salinan)')).toBe(true);
  });
});

describe('ClassFaqService', () => {
  let query: jest.Mock;
  let manager: Record<string, jest.Mock>;
  let service: ClassFaqService;
  let access: Record<string, unknown> | null;

  beforeEach(() => {
    access = { is_owner: true };
    query = jest.fn(async (sql: string) => {
      if (sql.includes('AS is_owner')) return access ? [access] : [];
      return [];
    });
    manager = {
      query,
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (value) => ({ ...value, id: faqId })),
      findOne: jest.fn(async () => ({
        id: faqId,
        class_id: classId,
        question: 'Q?',
        answer: 'A.',
      })),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      manager: { query },
    };
    service = new ClassFaqService(
      dataSource as unknown as DataSource,
      new ClassAccessService({ manager: { query } } as never),
    );
  });

  it('adds an entry for the owner under a class lock', async () => {
    await expect(
      service.create(userId, classId, { question: 'Q?', answer: 'A.' }),
    ).resolves.toEqual({
      data: { id: faqId, question: 'Q?', answer: 'A.' },
      responseMessage: 'Create class FAQ success',
    });
    expect(query.mock.calls.some(([sql]) => sql.includes('FOR UPDATE'))).toBe(
      true,
    );
  });

  it('rejects a 51st entry', async () => {
    manager.count.mockResolvedValue(50);
    await expect(
      service.create(userId, classId, { question: 'Q?', answer: 'A.' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('needs the materi permission of a tutor', async () => {
    access = {
      is_owner: false,
      role: 'moderator',
      permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
    };
    await expect(
      service.create(userId, classId, { question: 'Q?', answer: 'A.' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes an entry and hides another class entry', async () => {
    await service.remove(userId, classId, faqId);
    expect(manager.update).toHaveBeenCalledWith(
      ClassFaq,
      { id: faqId },
      { deleted_at: expect.any(Date), deleted_by: userId },
    );

    manager.findOne.mockResolvedValue(null);
    await expect(
      service.update(userId, classId, faqId, { answer: 'B.' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ClassDuplicationService', () => {
  it('lets only the owner duplicate', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        is_owner: false,
        role: 'lead',
        permissions: DEFAULT_TUTOR_PERMISSIONS.lead,
      },
    ]);
    const manager = { query, save: jest.fn() };
    const service = new ClassDuplicationService(
      { transaction: jest.fn((callback) => callback(manager)) } as never,
      new ClassAccessService({ manager: { query } } as never),
      {} as never,
    );

    await expect(
      service.duplicate(userId, classId, ClassType.VIDEO),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });
});
