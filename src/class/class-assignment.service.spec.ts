import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassAccessService } from './class-access.service';
import { ClassAssignmentService } from './class-assignment.service';
import { DEFAULT_TUTOR_PERMISSIONS } from './class-permissions';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Assignment, AssignmentType } from './entities/assignment.entity';
import {
  AssignmentQuestion,
  QuestionType,
} from './entities/assignment-question.entity';

const FUTURE = '2099-01-01T23:59:00+07:00';

function quiz(questions: object[]): CreateAssignmentDto {
  return {
    title: 'Kuis 1',
    due: FUTURE,
    type: AssignmentType.QUIZ,
    questions,
  } as CreateAssignmentDto;
}

const choice = {
  question_text: 'Perintah garis?',
  type: QuestionType.MULTIPLE_CHOICE,
  options: ['LINE', 'CIRCLE'],
  correct_answer: 'LINE',
  score_weight: 10,
};

describe('ClassAssignmentService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const assignmentId = '60000000-0000-4000-8000-000000000001';
  let access: Record<string, unknown> | null;
  let manager: Record<string, jest.Mock>;
  let service: ClassAssignmentService;

  beforeEach(() => {
    access = { is_owner: true };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('AS is_owner')) return access ? [access] : [];
      if (sql.includes('FROM submissions')) {
        return [{ assignment_id: assignmentId, count: 3 }];
      }
      return [];
    });
    manager = {
      query,
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(async () => [
        [{ id: assignmentId, class_id: classId, title: 'Kuis 1' }],
        1,
      ]),
      find: jest.fn(async () => [
        {
          id: 'question-id',
          assignment_id: assignmentId,
          ...choice,
        },
      ]),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity, value) =>
        entity === Assignment ? { ...value, id: assignmentId } : value,
      ),
      update: jest.fn(),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new ClassAssignmentService(
      dataSource as never,
      new ClassAccessService(dataSource as never),
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('creates a quiz with its questions', async () => {
    const response = await service.createAssignment(
      userId,
      classId,
      quiz([choice]),
    );

    expect(manager.save).toHaveBeenCalledWith(AssignmentQuestion, [
      expect.objectContaining({
        assignment_id: assignmentId,
        options: ['LINE', 'CIRCLE'],
        correct_answer: 'LINE',
      }),
    ]);
    expect(response.data).toMatchObject({
      id: assignmentId,
      submission_count: 3,
    });
  });

  it('keeps the author order of questions', async () => {
    await service.createAssignment(
      userId,
      classId,
      quiz([choice, { question_text: 'Jelaskan', type: QuestionType.ESSAY }]),
    );

    const [, saved] = manager.save.mock.calls.find(
      ([entity]) => entity === AssignmentQuestion,
    );
    expect(saved[1].created_at.getTime() - saved[0].created_at.getTime()).toBe(
      1,
    );
  });

  it.each([
    ['a quiz without questions', quiz([])],
    [
      'a correct answer outside the options',
      quiz([{ ...choice, correct_answer: 'ARC' }]),
    ],
    [
      'a multiple-choice question without a correct answer',
      quiz([{ ...choice, correct_answer: null }]),
    ],
    [
      'a due date in the past',
      { ...quiz([choice]), due: '2020-01-01T00:00:00Z' },
    ],
    [
      'questions on a file assignment',
      { ...quiz([choice]), type: AssignmentType.FILE_UPLOAD },
    ],
  ])('rejects %s', async (_label, dto) => {
    await expect(
      service.createAssignment(userId, classId, dto as CreateAssignmentDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a resource the caller did not register', async () => {
    manager.findOneBy.mockResolvedValue({
      id: 'asset-id',
      uploadedByUserId: 'someone-else',
      status: 'active',
      visibility: 'private',
    });

    await expect(
      service.createAssignment(userId, classId, {
        title: 'Tugas',
        due: FUTURE,
        type: AssignmentType.FILE_UPLOAD,
        resource_asset_id: 'asset-id',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids a moderator from creating assignments', async () => {
    access = {
      is_owner: false,
      role: 'moderator',
      permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
    };

    await expect(
      service.createAssignment(userId, classId, quiz([choice])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['the owner', { is_owner: true }, true],
    [
      'an assistant (grades)',
      {
        is_owner: false,
        role: 'assistant',
        permissions: DEFAULT_TUTOR_PERMISSIONS.assistant,
      },
      true,
    ],
    [
      'a moderator (meetings only)',
      {
        is_owner: false,
        role: 'moderator',
        permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
      },
      false,
    ],
  ])('shows correct answers to %s: %s', async (_label, row, visible) => {
    access = row;

    const { data } = await service.getAssignments(userId, classId);

    expect('correct_answer' in data[0].questions[0]).toBe(visible);
    expect(data[0].submission_count).toBe(3);
  });

  it('soft-deletes an assignment with its questions', async () => {
    manager.findOne.mockResolvedValue({ id: assignmentId, class_id: classId });

    await service.deleteAssignment(userId, classId, assignmentId);

    expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([
      AssignmentQuestion,
      Assignment,
    ]);
  });

  it('returns 404 when deleting an assignment of another class', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.deleteAssignment(userId, classId, assignmentId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('ClassAssignmentService.updateAssignment', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const assignmentId = '60000000-0000-4000-8000-000000000001';
  const resourceId = '70000000-0000-4000-8000-000000000001';
  let access: Record<string, unknown>;
  let submitted: boolean;
  let stored: Record<string, unknown> | null;
  let storedQuestions: Record<string, unknown>[];
  let manager: Record<string, jest.Mock>;
  let service: ClassAssignmentService;

  beforeEach(() => {
    access = { is_owner: true };
    submitted = false;
    stored = {
      id: assignmentId,
      class_id: classId,
      title: 'Kuis 1',
      description: null,
      due: new Date('2099-01-01T00:00:00Z'),
      type: AssignmentType.QUIZ,
      resource_asset_id: resourceId,
    };
    storedQuestions = [
      { id: 'question-id', assignment_id: assignmentId, ...choice },
    ];
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('AS is_owner')) return [access];
        if (sql.includes('LIMIT 1') && sql.includes('FROM submissions')) {
          return submitted ? [{ '?column?': 1 }] : [];
        }
        return [];
      }),
      findOne: jest.fn(async () => (stored ? { ...stored } : null)),
      findOneBy: jest.fn(),
      find: jest.fn(async () => storedQuestions),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
      update: jest.fn(),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new ClassAssignmentService(
      dataSource as never,
      new ClassAccessService(dataSource as never),
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  const update = (dto: object) =>
    service.updateAssignment(
      userId,
      classId,
      assignmentId,
      dto as UpdateAssignmentDto,
    );
  const savedAssignment = () =>
    manager.save.mock.calls.find(([entity]) => entity === Assignment)?.[1];
  const questionWrites = () =>
    manager.save.mock.calls.filter(([entity]) => entity === AssignmentQuestion)
      .length + manager.update.mock.calls.length;

  it('corrects the title and due date under a row lock and keeps submissions', async () => {
    submitted = true;

    const response = await update({
      title: 'Kuis 1 (revisi)',
      due: '2099-02-01T23:59:00+07:00',
    });

    expect(manager.findOne).toHaveBeenCalledWith(Assignment, {
      where: { id: assignmentId, class_id: classId },
      lock: { mode: 'pessimistic_write' },
    });
    expect(savedAssignment()).toMatchObject({
      title: 'Kuis 1 (revisi)',
      due: new Date('2099-02-01T23:59:00+07:00'),
      type: AssignmentType.QUIZ,
      updated_by: userId,
    });
    expect(questionWrites()).toBe(0);
    expect(response).toMatchObject({
      data: { id: assignmentId, title: 'Kuis 1 (revisi)' },
      responseMessage: 'Update assignment success',
    });
  });

  it('needs the tugas.edit permission', async () => {
    access = {
      is_owner: false,
      role: 'assistant',
      permissions: DEFAULT_TUTOR_PERMISSIONS.assistant,
    };

    await expect(update({ title: 'Baru' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    access = {
      is_owner: false,
      role: 'assistant',
      permissions: {
        ...DEFAULT_TUTOR_PERMISSIONS.assistant,
        tugas: { lihat: true, tambah: false, edit: true, delete: false },
      },
    };
    await expect(update({ title: 'Baru' })).resolves.toBeDefined();
  });

  it('returns 404 for an assignment of another class', async () => {
    stored = null;

    await expect(update({ title: 'Baru' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a due date in the past before opening a transaction', async () => {
    await expect(
      update({ due: '2020-01-01T00:00:00Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.findOne).not.toHaveBeenCalled();
  });

  it('refuses a type change once learners have submitted (409)', async () => {
    submitted = true;

    await expect(
      update({ type: AssignmentType.FILE_UPLOAD }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('turns a quiz without submissions into a file assignment and drops its questions', async () => {
    await update({ type: AssignmentType.FILE_UPLOAD });

    expect(savedAssignment()).toMatchObject({
      type: AssignmentType.FILE_UPLOAD,
    });
    expect(manager.update).toHaveBeenCalledWith(
      AssignmentQuestion,
      expect.objectContaining({ assignment_id: assignmentId }),
      expect.objectContaining({ deleted_by: userId }),
    );
  });

  it('refuses a file assignment turned quiz without questions', async () => {
    stored = { ...stored, type: AssignmentType.FILE_UPLOAD };
    storedQuestions = [];

    await expect(update({ type: AssignmentType.QUIZ })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses changed questions once learners have submitted (409)', async () => {
    submitted = true;

    await expect(
      update({ questions: [{ ...choice, score_weight: 20 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('accepts the current questions resent unchanged after submissions', async () => {
    submitted = true;

    await update({ title: 'Kuis 1', questions: [{ ...choice }] });

    expect(savedAssignment()).toBeDefined();
    expect(questionWrites()).toBe(0);
  });

  it('replaces the questions while nobody has submitted', async () => {
    const essay = { question_text: 'Jelaskan', type: QuestionType.ESSAY };

    await update({ questions: [choice, essay] });

    expect(manager.update).toHaveBeenCalledWith(
      AssignmentQuestion,
      expect.objectContaining({ assignment_id: assignmentId }),
      expect.objectContaining({ deleted_by: userId }),
    );
    const [, saved] = manager.save.mock.calls.find(
      ([entity]) => entity === AssignmentQuestion,
    );
    expect(saved).toEqual([
      expect.objectContaining({ correct_answer: 'LINE', score_weight: 10 }),
      expect.objectContaining({
        type: QuestionType.ESSAY,
        options: null,
        correct_answer: null,
        score_weight: 0,
      }),
    ]);
  });

  it('applies the create rules to sent questions', async () => {
    await expect(
      update({ questions: [{ ...choice, correct_answer: 'ARC' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(update({ questions: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('checks a new resource like create, but not the one already attached', async () => {
    const otherResource = '70000000-0000-4000-8000-000000000002';
    manager.findOneBy.mockResolvedValue({
      id: otherResource,
      uploadedByUserId: 'someone-else',
      status: 'active',
      visibility: 'private',
    });

    await expect(
      update({ resource_asset_id: otherResource }),
    ).rejects.toBeInstanceOf(BadRequestException);

    manager.findOneBy.mockClear();
    await update({ resource_asset_id: resourceId });
    expect(manager.findOneBy).not.toHaveBeenCalled();

    manager.save.mockClear();
    await update({ resource_asset_id: null });
    expect(savedAssignment()).toMatchObject({
      resource_asset_id: null,
    });
  });
});

describe('UpdateAssignmentDto inputs', () => {
  async function errorFields(input: object) {
    const errors = await validate(plainToInstance(UpdateAssignmentDto, input));
    return errors.map((error) => error.property);
  }

  it.each([
    [{}, []],
    [{ title: 'Kuis 2', due: FUTURE }, []],
    [{ description: null, resource_asset_id: null }, []],
    [{ title: null }, ['title']],
    [{ title: '  ' }, ['title']],
    [{ due: null }, ['due']],
    [{ type: null }, ['type']],
    [{ type: 'file' }, ['type']],
    [{ questions: null }, ['questions']],
    [{ resource_asset_id: 'not-a-uuid' }, ['resource_asset_id']],
    [{ questions: [{ ...choice, options: ['A'] }] }, ['questions']],
  ])('%j fails on %j', async (input, fields) => {
    expect(await errorFields(input)).toEqual(fields);
  });
});

describe('CreateAssignmentDto validation', () => {
  async function errorFields(input: object) {
    const errors = await validate(plainToInstance(CreateAssignmentDto, input));
    return errors.map((error) => error.property);
  }

  it.each([
    [quiz([{ ...choice, options: ['A', 'B', 'C', 'D', 'E'] }]), ['questions']],
    [quiz([{ ...choice, options: ['A'] }]), ['questions']],
    [quiz([{ ...choice, score_weight: -1 }]), ['questions']],
    [{ ...quiz([choice]), questions: undefined }, ['questions']],
    [{ ...quiz([choice]), due: '15/10/2026' }, ['due']],
    [{ ...quiz([choice]), type: 'file' }, ['type']],
    [quiz([{ question_text: 'Jelaskan', type: QuestionType.ESSAY }]), []],
    [{ title: 'Tugas', due: FUTURE, type: AssignmentType.FILE_UPLOAD }, []],
  ])('%j fails on %j', async (input, fields) => {
    expect(await errorFields(input)).toEqual(fields);
  });
});

describe('CreateAssignmentDto inputs', () => {
  const parse = (input: object) => plainToInstance(CreateAssignmentDto, input);

  it('clears the description and an essay answer key', async () => {
    const dto = parse({
      ...quiz([
        { question_text: 'Jelaskan', type: 'Essay', correct_answer: '  ' },
      ]),
      description: null,
    });

    expect(dto.description).toBeNull();
    expect(dto.questions?.[0]).toMatchObject({
      type: QuestionType.ESSAY,
      correct_answer: null,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('stores types canonically, trims options and accepts a numeric weight', async () => {
    const dto = parse({
      ...quiz([
        {
          question_text: ' Perintah garis? ',
          type: 'Multiple_Choice',
          options: [' LINE ', 'CIRCLE'],
          correct_answer: 'LINE ',
          score_weight: '10',
        },
      ]),
      type: 'QUIZ',
    });

    expect(dto.type).toBe(AssignmentType.QUIZ);
    expect(dto.questions?.[0]).toMatchObject({
      question_text: 'Perintah garis?',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['LINE', 'CIRCLE'],
      correct_answer: 'LINE',
      score_weight: 10,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([[''], ['  '], [null]])(
    'rejects the required title %j',
    async (title) => {
      const errors = await validate(parse({ ...quiz([choice]), title }));
      expect(errors.map((error) => error.property)).toEqual(['title']);
    },
  );

  it.each([
    [{ question_text: '' }],
    [{ question_text: null }],
    [{ options: ['LINE', '  '] }],
    [{ score_weight: null }],
  ])('rejects question %j', async (change) => {
    const errors = await validate(parse(quiz([{ ...choice, ...change }])));
    expect(errors.map((error) => error.property)).toEqual(['questions']);
  });
});
