import { BadRequestException, ConflictException } from '@nestjs/common';
import { Submission } from '../../class/entities/submission.entity';
import { SubmissionAnswer } from '../../class/entities/submission-answer.entity';
import {
  LearningSubmissionService,
  matchAnswers,
  quizScore,
} from './learning-submission.service';

const mc = (id: string, correct: string, weight = 25) => ({
  id,
  type: 'multiple_choice' as const,
  options: ['LINE', 'CIRCLE', 'ARC'],
  correct_answer: correct,
  score_weight: weight,
});
const essay = (id: string, weight = 20) => ({
  id,
  type: 'essay' as const,
  options: null,
  correct_answer: null,
  score_weight: weight,
});
const answers = (pairs: Array<[string, string]>) => ({
  answers: pairs.map(([question_id, answer]) => ({ question_id, answer })),
});

describe('quiz scoring', () => {
  const quiz = [
    mc('q1', 'LINE'),
    mc('q2', 'CIRCLE'),
    mc('q3', 'ARC'),
    mc('q4', 'LINE'),
  ];

  it('scores 3 of 4 equally weighted questions as 75', () => {
    const matched = matchAnswers(
      quiz,
      answers([
        ['q1', 'LINE'],
        ['q2', 'CIRCLE'],
        ['q3', 'ARC'],
        ['q4', 'ARC'],
      ]),
    );
    expect(matched.map((a) => a.isCorrect)).toEqual([true, true, true, false]);
    expect(quizScore(quiz, matched)).toBe(75);
  });

  it('leaves the score open while an essay is ungraded', () => {
    const withEssay = [mc('q1', 'LINE', 20), essay('q2')];
    const matched = matchAnswers(
      withEssay,
      answers([
        ['q1', 'LINE'],
        ['q2', 'Layer memisahkan objek.'],
      ]),
    );
    expect(matched[1]).toMatchObject({ isCorrect: null, score: null });
    expect(quizScore(withEssay, matched)).toBeNull();
  });

  it.each([
    [
      'a missing answer',
      answers([
        ['q1', 'LINE'],
        ['q2', 'CIRCLE'],
        ['q3', 'ARC'],
      ]),
    ],
    [
      'a blank answer',
      answers([
        ['q1', 'LINE'],
        ['q2', 'CIRCLE'],
        ['q3', 'ARC'],
        ['q4', ' '],
      ]),
    ],
    [
      'an answer outside the options',
      answers([
        ['q1', 'POLYLINE'],
        ['q2', 'CIRCLE'],
        ['q3', 'ARC'],
        ['q4', 'LINE'],
      ]),
    ],
    [
      'a question of another quiz',
      answers([
        ['q1', 'LINE'],
        ['q2', 'CIRCLE'],
        ['q3', 'ARC'],
        ['q4', 'LINE'],
        ['x', 'LINE'],
      ]),
    ],
    [
      'two answers to one question',
      answers([
        ['q1', 'LINE'],
        ['q1', 'ARC'],
        ['q2', 'CIRCLE'],
        ['q3', 'ARC'],
        ['q4', 'LINE'],
      ]),
    ],
  ])('rejects %s', (_label, input) => {
    expect(() => matchAnswers(quiz, input)).toThrow(BadRequestException);
  });
});

describe('LearningSubmissionService timing', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const assignmentId = '60000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let assignment: Record<string, unknown>;
  let existing: Record<string, unknown> | null;
  let service: LearningSubmissionService;

  beforeEach(() => {
    assignment = { type: 'file_upload', due: new Date(Date.now() + 3600_000) };
    existing = null;
    manager = {
      query: jest.fn(async () => []),
      findOne: jest.fn(async () => existing),
      findOneBy: jest.fn(async () => ({
        id: 'asset-id',
        uploadedByUserId: userId,
        status: 'active',
        visibility: 'private',
        originalFilename: 'denah.dwg',
        mimeType: 'application/octet-stream',
        sizeBytes: '1000',
      })),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (_entity, value) => ({
        id: 'submission-id',
        ...value,
      })),
      delete: jest.fn(),
      insert: jest.fn(),
    };
    const learningAssignment = {
      findLearnerAssignment: jest.fn(async () => assignment),
      toAssignment: jest.fn(async () => ({})),
    };
    service = new LearningSubmissionService(
      { transaction: jest.fn((callback) => callback(manager)) } as never,
      learningAssignment as never,
    );
  });

  const savedSubmission = () =>
    manager.save.mock.calls.find(([entity]) => entity === Submission)?.[1];

  it('replaces an earlier submission before the due time and clears its grade', async () => {
    existing = { id: 'submission-id', total_score: 90, feedback: 'Bagus' };

    await service.submitFile(userId, assignmentId, {
      file_asset_id: 'asset-id',
    });

    expect(savedSubmission()).toMatchObject({
      id: 'submission-id',
      fileName: 'denah.dwg',
      total_score: null,
      feedback: null,
      is_late: false,
    });
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`submission:${assignmentId}:${userId}`],
    );
  });

  it('accepts a first submission after the due time as late', async () => {
    assignment.due = new Date(Date.now() - 3600_000);

    await service.submitFile(userId, assignmentId, {
      file_asset_id: 'asset-id',
    });

    expect(savedSubmission()).toMatchObject({ is_late: true });
  });

  it('refuses to change a submission after the due time', async () => {
    assignment.due = new Date(Date.now() - 3600_000);
    existing = { id: 'submission-id' };

    await expect(
      service.submitFile(userId, assignmentId, { file_asset_id: 'asset-id' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuses quiz answers for a file assignment and the reverse', async () => {
    await expect(
      service.submitQuiz(userId, assignmentId, answers([['q1', 'LINE']])),
    ).rejects.toBeInstanceOf(BadRequestException);
    assignment.type = 'quiz';
    await expect(
      service.submitFile(userId, assignmentId, { file_asset_id: 'asset-id' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces the previous quiz answers on a retake', async () => {
    assignment.type = 'quiz';
    existing = { id: 'submission-id' };
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM assignment_questions')
        ? [mc('q1', 'LINE', 50), mc('q2', 'ARC', 50)]
        : [],
    );

    await service.submitQuiz(
      userId,
      assignmentId,
      answers([
        ['q1', 'LINE'],
        ['q2', 'LINE'],
      ]),
    );

    expect(manager.delete).toHaveBeenCalledWith(SubmissionAnswer, {
      submission_id: 'submission-id',
    });
    expect(savedSubmission()).toMatchObject({ total_score: 50 });
    expect(manager.insert.mock.calls[0][1]).toHaveLength(2);
  });
});
