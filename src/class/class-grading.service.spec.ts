import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassAccessService } from './class-access.service';
import { ClassGradingService } from './class-grading.service';
import { DEFAULT_TUTOR_PERMISSIONS } from './class-permissions';
import { Submission } from './entities/submission.entity';
import { SubmissionAnswer } from './entities/submission-answer.entity';

describe('ClassGradingService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const submissionId = '70000000-0000-4000-8000-000000000001';
  let access: Record<string, unknown> | null;
  let assignmentType: string | null;
  let answers: Array<Record<string, unknown>>;
  let manager: Record<string, jest.Mock>;
  let service: ClassGradingService;

  beforeEach(() => {
    access = { is_owner: true };
    assignmentType = 'file_upload';
    answers = [];
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('AS is_owner')) return access ? [access] : [];
        if (sql.includes('FOR UPDATE OF submission')) {
          return assignmentType
            ? [{ id: submissionId, type: assignmentType }]
            : [];
        }
        if (sql.includes('FROM submission_answers answer')) return answers;
        return [];
      }),
      findOneByOrFail: jest.fn(async () => ({ id: submissionId })),
      save: jest.fn(async (_entity, value) => value),
      update: jest.fn(),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new ClassGradingService(
      dataSource as never,
      new ClassAccessService(dataSource as never),
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  const saved = () =>
    manager.save.mock.calls.find(([entity]) => entity === Submission)?.[1];

  it('scores a file submission with feedback and records the grader', async () => {
    await service.gradeSubmission(userId, classId, submissionId, {
      score: 85,
      feedback: 'Rapi',
    });

    expect(saved()).toMatchObject({
      total_score: 85,
      feedback: 'Rapi',
      graded_by: userId,
      graded_at: expect.any(Date),
    });
  });

  it('requires a score for a file submission', async () => {
    await expect(
      service.gradeSubmission(userId, classId, submissionId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes a quiz score once every essay is scored', async () => {
    assignmentType = 'quiz';
    answers = [
      {
        id: 'a1',
        question_id: 'q1',
        type: 'multiple_choice',
        score_weight: 20,
        score_awarded: 20,
      },
      {
        id: 'a2',
        question_id: 'q2',
        type: 'essay',
        score_weight: 20,
        score_awarded: null,
      },
    ];

    await service.gradeSubmission(userId, classId, submissionId, {
      essay_scores: [{ question_id: 'q2', score: 15 }],
    });

    expect(manager.update).toHaveBeenCalledWith(
      SubmissionAnswer,
      { id: 'a2' },
      { score_awarded: 15 },
    );
    expect(saved()).toMatchObject({ total_score: 88 });
  });

  it.each([
    [
      'an essay above its weight',
      { essay_scores: [{ question_id: 'q2', score: 30 }] },
    ],
    [
      'a multiple-choice question as an essay',
      { essay_scores: [{ question_id: 'q1', score: 5 }] },
    ],
    ['a direct quiz score', { score: 90 }],
  ])('rejects %s', async (_label, input) => {
    assignmentType = 'quiz';
    answers = [
      {
        id: 'a1',
        question_id: 'q1',
        type: 'multiple_choice',
        score_weight: 20,
        score_awarded: 20,
      },
      {
        id: 'a2',
        question_id: 'q2',
        type: 'essay',
        score_weight: 20,
        score_awarded: null,
      },
    ];

    await expect(
      service.gradeSubmission(userId, classId, submissionId, input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('forbids tutors without grading permission', async () => {
    access = {
      is_owner: false,
      role: 'moderator',
      permissions: DEFAULT_TUTOR_PERMISSIONS.moderator,
    };

    await expect(
      service.gradeSubmission(userId, classId, submissionId, { score: 80 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findSubmissions(userId, classId, 'assignment-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 for a submission of another class', async () => {
    assignmentType = null;

    await expect(
      service.gradeSubmission(userId, classId, submissionId, { score: 80 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
