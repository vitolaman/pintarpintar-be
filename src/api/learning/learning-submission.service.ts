import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Submission } from '../../class/entities/submission.entity';
import { SubmissionAnswer } from '../../class/entities/submission-answer.entity';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import {
  SubmitAssignmentDto,
  SubmitQuizDto,
} from './dto/learning-assignment.dto';
import { LearningAssignmentService } from './learning-assignment.service';

interface QuestionRow {
  id: string;
  type: 'multiple_choice' | 'essay';
  options: string[] | null;
  correct_answer: string | null;
  score_weight: number;
}

// One submission per learner and assignment; the latest attempt counts.
// Before the due time an attempt replaces the previous one and clears its
// grade. After it, only a first attempt is accepted, marked late.
@Injectable()
export class LearningSubmissionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly learningAssignment: LearningAssignmentService,
  ) {}

  async submitFile(
    userId: string,
    assignmentId: string,
    input: SubmitAssignmentDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.learningAssignment.findLearnerAssignment(
        manager,
        userId,
        assignmentId,
      );
      if (assignment.type !== 'file_upload') {
        throw new BadRequestException('This assignment takes quiz answers');
      }
      const { submission, isLate } = await this.prepareAttempt(
        manager,
        userId,
        assignmentId,
        assignment.due,
      );
      const asset = await assertOwnedAsset(
        manager,
        userId,
        input.file_asset_id,
        'submission_file',
      );

      Object.assign(submission, {
        file_asset_id: asset.id,
        fileName: asset.originalFilename,
        fileUrl: null,
        total_score: null,
      });
      await this.saveAttempt(manager, submission, isLate, userId);
      return this.response(
        manager,
        userId,
        assignmentId,
        'Submit assignment success',
      );
    });
  }

  async submitQuiz(userId: string, assignmentId: string, input: SubmitQuizDto) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.learningAssignment.findLearnerAssignment(
        manager,
        userId,
        assignmentId,
      );
      if (assignment.type !== 'quiz') {
        throw new BadRequestException('This assignment takes a file');
      }
      const questions: QuestionRow[] = await manager.query(
        `SELECT id, type, options, correct_answer, score_weight
         FROM assignment_questions
         WHERE assignment_id = $1 AND deleted_at IS NULL`,
        [assignmentId],
      );
      const answers = matchAnswers(questions, input);
      const { submission, isLate } = await this.prepareAttempt(
        manager,
        userId,
        assignmentId,
        assignment.due,
      );

      Object.assign(submission, {
        file_asset_id: null,
        fileName: null,
        fileUrl: null,
        total_score: quizScore(questions, answers),
      });
      const saved = await this.saveAttempt(manager, submission, isLate, userId);
      await manager.delete(SubmissionAnswer, { submission_id: saved.id });
      await manager.insert(
        SubmissionAnswer,
        answers.map((answer) => ({
          submission_id: saved.id,
          question_id: answer.question.id,
          user_answer: answer.value,
          is_correct: answer.isCorrect,
          score_awarded: answer.score,
          created_by: userId,
        })),
      );
      return this.response(
        manager,
        userId,
        assignmentId,
        'Submit quiz success',
      );
    });
  }

  private async prepareAttempt(
    manager: EntityManager,
    userId: string,
    assignmentId: string,
    due: Date | null,
  ): Promise<{ submission: Submission; isLate: boolean }> {
    // Serialises a learner's attempts, including two concurrent first ones.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `submission:${assignmentId}:${userId}`,
    ]);
    const pastDue = due !== null && new Date(due).getTime() < Date.now();
    const existing = await manager.findOne(Submission, {
      where: { assignment_id: assignmentId, user_id: userId },
    });
    if (existing && pastDue) {
      throw new ConflictException(
        'The due time has passed; the submission can no longer be changed',
      );
    }
    return {
      submission:
        existing ??
        manager.create(Submission, {
          assignment_id: assignmentId,
          user_id: userId,
        }),
      isLate: pastDue,
    };
  }

  private async saveAttempt(
    manager: EntityManager,
    submission: Submission,
    isLate: boolean,
    userId: string,
  ): Promise<Submission> {
    Object.assign(submission, {
      submissionDate: new Date(),
      is_late: isLate,
      feedback: null,
      graded_at: null,
      graded_by: null,
      updated_by: userId,
    });
    return manager.save(Submission, submission);
  }

  private async response(
    manager: EntityManager,
    userId: string,
    assignmentId: string,
    responseMessage: string,
  ) {
    const row = await this.learningAssignment.findLearnerAssignment(
      manager,
      userId,
      assignmentId,
    );
    return {
      data: await this.learningAssignment.toAssignment(row),
      responseMessage,
    };
  }
}

interface MatchedAnswer {
  question: QuestionRow;
  value: string;
  isCorrect: boolean | null;
  score: number | null;
}

// Every question needs exactly one answer; a multiple-choice answer must be
// one of its options and is scored at once, essays wait for a tutor.
export function matchAnswers(
  questions: QuestionRow[],
  input: SubmitQuizDto,
): MatchedAnswer[] {
  const byQuestion = new Map(
    input.answers.map((a) => [a.question_id, a.answer]),
  );
  if (byQuestion.size !== input.answers.length) {
    throw new BadRequestException('Each question can be answered only once');
  }
  const known = new Set(questions.map((question) => question.id));
  if (input.answers.some((answer) => !known.has(answer.question_id))) {
    throw new BadRequestException('An answer refers to another quiz');
  }
  return questions.map((question) => {
    const value = byQuestion.get(question.id);
    if (value === undefined) {
      throw new BadRequestException('Every question must be answered');
    }
    if (question.type === 'essay') {
      return { question, value, isCorrect: null, score: null };
    }
    // Answers arrive trimmed; older questions may store options and their
    // correct answer with surrounding spaces, so the stored option is the
    // one compared with the answer key.
    const option = question.options?.find(
      (candidate) => candidate.trim() === value,
    );
    if (option === undefined) {
      throw new BadRequestException(
        'A multiple-choice answer must be one of its options',
      );
    }
    const isCorrect = option === question.correct_answer;
    return {
      question,
      value,
      isCorrect,
      score: isCorrect ? question.score_weight : 0,
    };
  });
}

// Percentage of the quiz's total weight, once no essay is left to grade.
export function quizScore(
  questions: QuestionRow[],
  answers: Array<{ score: number | null }>,
): number | null {
  if (answers.some((answer) => answer.score === null)) return null;
  const totalWeight = questions.reduce((sum, q) => sum + q.score_weight, 0);
  if (totalWeight === 0) return 100;
  const awarded = answers.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
  return Math.round((awarded / totalWeight) * 100);
}
