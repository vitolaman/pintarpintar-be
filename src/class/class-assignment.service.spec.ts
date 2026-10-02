import {
  BadRequestException,
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
