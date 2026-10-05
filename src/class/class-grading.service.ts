import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assetUrl } from '../common/storage/asset-url';
import {
  ObjectStorage,
  createObjectStorage,
} from '../common/storage/object-storage';
import { signedDownloadUrl } from '../common/storage/signed-download-url';
import { ClassAccessService } from './class-access.service';
import { ClassCertificateService } from './class-certificate.service';
import { GradeSubmissionDto } from './dto/grading.dto';
import { Submission } from './entities/submission.entity';
import { SubmissionAnswer } from './entities/submission-answer.entity';
import { loadLearnerMetrics } from './learner-metrics';
import { paginationMeta } from '../common/dto/response-meta.dto';
import { queueSubmissionGradedEmail } from '~/api/email/events/learning-emails';

interface SubmissionRow {
  id: string;
  assignment_id: string;
  assignment_type: string;
  user_id: string;
  name: string;
  avatar_object_key: string | null;
  submitted_at: Date;
  is_late: boolean;
  file_name: string | null;
  file_object_key: string | null;
  total_score: number | null;
  feedback: string | null;
  graded_at: Date | null;
}

const SUBMISSIONS_SQL = `
  SELECT submission.id, submission.assignment_id, assignment.type AS assignment_type,
         submission.user_id, learner.name, avatar.object_key AS avatar_object_key,
         submission."submissionDate" AS submitted_at, submission.is_late,
         submission."fileName" AS file_name, file.object_key AS file_object_key,
         submission.total_score, submission.feedback, submission.graded_at
  FROM submissions submission
  INNER JOIN assignments assignment
    ON assignment.id = submission.assignment_id AND assignment.deleted_at IS NULL
  INNER JOIN users learner ON learner.id = submission.user_id
  LEFT JOIN user_profiles profile ON profile.user_id = learner.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
  LEFT JOIN file_assets file ON file.id = submission.file_asset_id AND file.deleted_at IS NULL
  WHERE submission.deleted_at IS NULL AND assignment.class_id = $1
`;

// Reviewing and scoring learners' work needs the `nilai` permission.
@Injectable()
export class ClassGradingService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
    private readonly certificates: ClassCertificateService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findSubmissions(
    userId: string,
    classId: string,
    assignmentId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAction(userId, classId, 'nilai', 'lihat');
    const manager = this.dataSource.manager;
    await this.findAssignment(manager, classId, assignmentId);

    const [{ total }] = await manager.query(
      `SELECT count(*)::integer AS total FROM (${SUBMISSIONS_SQL} AND submission.assignment_id = $2) rows`,
      [classId, assignmentId],
    );
    const rows: SubmissionRow[] = await manager.query(
      `${SUBMISSIONS_SQL} AND submission.assignment_id = $2
       ORDER BY submission."submissionDate", submission.id
       LIMIT $3 OFFSET $4`,
      [classId, assignmentId, limit, (page - 1) * limit],
    );
    return {
      data: await this.toSubmissions(manager, rows),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get submissions success',
    };
  }

  // Files get a score from 0 to 100. Quizzes get essay scores up to each
  // question's weight; the quiz score follows once every essay is scored.
  async gradeSubmission(
    userId: string,
    classId: string,
    submissionId: string,
    input: GradeSubmissionDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'nilai',
        'edit',
        manager,
      );
      const [target] = await manager.query(
        `SELECT submission.id, assignment.type
         FROM submissions submission
         INNER JOIN assignments assignment
           ON assignment.id = submission.assignment_id AND assignment.deleted_at IS NULL
         WHERE submission.id = $1 AND assignment.class_id = $2 AND submission.deleted_at IS NULL
         FOR UPDATE OF submission`,
        [submissionId, classId],
      );
      if (!target) throw new NotFoundException('Submission not found');
      const submission = await manager.findOneByOrFail(Submission, {
        id: submissionId,
      });

      if (target.type === 'quiz') {
        if (input.score !== undefined) {
          throw new BadRequestException(
            'A quiz score comes from its answers; send essay_scores instead',
          );
        }
        submission.total_score = await this.scoreEssays(
          manager,
          submissionId,
          input.essay_scores ?? [],
        );
      } else {
        if (input.essay_scores?.length) {
          throw new BadRequestException('Only quizzes have essay scores');
        }
        if (input.score === undefined) {
          throw new BadRequestException(
            'score is required for a file assignment',
          );
        }
        submission.total_score = input.score;
      }
      if (input.feedback !== undefined) submission.feedback = input.feedback;
      submission.graded_at = new Date();
      submission.graded_by = userId;
      submission.updated_by = userId;
      await manager.save(Submission, submission);
      await queueSubmissionGradedEmail(
        manager,
        submission.id,
        submission.graded_at.toISOString(),
      );
      await this.certificates.issueEligible(manager, classId, [
        submission.user_id,
      ]);

      const rows: SubmissionRow[] = await manager.query(
        `${SUBMISSIONS_SQL} AND submission.id = $2`,
        [classId, submissionId],
      );
      const [data] = await this.toSubmissions(manager, rows);
      return { data, responseMessage: 'Grade submission success' };
    });
  }

  async findGradeTable(userId: string, classId: string, page = 1, limit = 10) {
    await this.classAccess.requireAction(userId, classId, 'nilai', 'lihat');
    const manager = this.dataSource.manager;

    const [{ total }] = await manager.query(
      `SELECT count(*)::integer AS total FROM enrollments
       WHERE class_id = $1 AND deleted_at IS NULL`,
      [classId],
    );
    const learners: Array<{ user_id: string; name: string; email: string }> =
      await manager.query(
        `SELECT learner.id AS user_id, learner.name, learner.email
         FROM enrollments enrollment
         INNER JOIN users learner ON learner.id = enrollment.user_id
         WHERE enrollment.class_id = $1 AND enrollment.deleted_at IS NULL
         ORDER BY learner.name, learner.id
         LIMIT $2 OFFSET $3`,
        [classId, limit, (page - 1) * limit],
      );
    const userIds = learners.map((learner) => learner.user_id);
    const [assignments, scores, metrics, allMetrics] = await Promise.all([
      manager.query(
        `SELECT id, title, type, due FROM assignments
         WHERE class_id = $1 AND deleted_at IS NULL
         ORDER BY due NULLS LAST, created_at, id`,
        [classId],
      ),
      userIds.length === 0
        ? []
        : manager.query(
            `SELECT submission.user_id, submission.assignment_id, submission.total_score
             FROM submissions submission
             INNER JOIN assignments assignment
               ON assignment.id = submission.assignment_id AND assignment.deleted_at IS NULL
             WHERE assignment.class_id = $1 AND submission.deleted_at IS NULL
               AND submission.user_id = ANY($2::uuid[])`,
            [classId, userIds],
          ),
      userIds.length === 0 ? [] : loadLearnerMetrics(manager, classId, userIds),
      loadLearnerMetrics(manager, classId),
    ]);

    const averages = allMetrics
      .map((metric) => metric.average_score)
      .filter((score): score is number => score !== null);
    return {
      data: {
        assignments,
        class_average:
          averages.length === 0
            ? null
            : Math.round(
                (averages.reduce((sum, score) => sum + score, 0) /
                  averages.length) *
                  10,
              ) / 10,
        learners: learners.map((learner) => ({
          ...learner,
          scores: assignments.map((assignment) => ({
            assignment_id: assignment.id,
            score:
              scores.find(
                (row) =>
                  row.user_id === learner.user_id &&
                  row.assignment_id === assignment.id,
              )?.total_score ?? null,
          })),
          average_score:
            metrics.find((metric) => metric.user_id === learner.user_id)
              ?.average_score ?? null,
        })),
      },
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get class grades success',
    };
  }

  private async scoreEssays(
    manager: EntityManager,
    submissionId: string,
    essayScores: Array<{ question_id: string; score: number }>,
  ): Promise<number | null> {
    const answers: Array<{
      id: string;
      question_id: string;
      type: string;
      score_weight: number;
      score_awarded: number | null;
    }> = await manager.query(
      `SELECT answer.id, answer.question_id, question.type, question.score_weight,
              answer.score_awarded
       FROM submission_answers answer
       INNER JOIN assignment_questions question ON question.id = answer.question_id
       WHERE answer.submission_id = $1 AND answer.deleted_at IS NULL`,
      [submissionId],
    );
    for (const essayScore of essayScores) {
      const answer = answers.find(
        (row) => row.question_id === essayScore.question_id,
      );
      if (!answer || answer.type !== 'essay') {
        throw new BadRequestException(
          'essay_scores must refer to essay answers of this submission',
        );
      }
      if (essayScore.score > answer.score_weight) {
        throw new BadRequestException(
          `An essay score cannot exceed its weight of ${answer.score_weight}`,
        );
      }
      answer.score_awarded = essayScore.score;
      await manager.update(
        SubmissionAnswer,
        { id: answer.id },
        { score_awarded: essayScore.score },
      );
    }
    if (answers.some((answer) => answer.score_awarded === null)) return null;
    const totalWeight = answers.reduce((sum, row) => sum + row.score_weight, 0);
    if (totalWeight === 0) return 100;
    const awarded = answers.reduce((sum, row) => sum + row.score_awarded, 0);
    return Math.round((awarded / totalWeight) * 100);
  }

  private async findAssignment(
    manager: EntityManager,
    classId: string,
    assignmentId: string,
  ): Promise<void> {
    const [assignment] = await manager.query(
      `SELECT id FROM assignments WHERE id = $1 AND class_id = $2 AND deleted_at IS NULL`,
      [assignmentId, classId],
    );
    if (!assignment) throw new NotFoundException('Assignment not found');
  }

  private async toSubmissions(manager: EntityManager, rows: SubmissionRow[]) {
    const ids = rows.map((row) => row.id);
    const answers =
      ids.length === 0
        ? []
        : await manager.query(
            `SELECT answer.submission_id, answer.question_id, question.question_text,
                    question.type, question.score_weight, answer.user_answer,
                    answer.is_correct, answer.score_awarded
             FROM submission_answers answer
             INNER JOIN assignment_questions question ON question.id = answer.question_id
             WHERE answer.submission_id = ANY($1::uuid[]) AND answer.deleted_at IS NULL
             ORDER BY question.created_at, question.id`,
            [ids],
          );
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        assignment_id: row.assignment_id,
        learner: {
          user_id: row.user_id,
          name: row.name,
          avatar_url: assetUrl(row.avatar_object_key),
        },
        submitted_at: row.submitted_at,
        is_late: row.is_late,
        file_name: row.file_name,
        file_download_url: row.file_object_key
          ? await signedDownloadUrl(
              this.storage,
              row.file_object_key,
              row.file_name ?? 'submission',
            )
          : null,
        answers: answers
          .filter((answer) => answer.submission_id === row.id)
          .map((answer) => ({
            question_id: answer.question_id,
            question_text: answer.question_text,
            type: answer.type,
            score_weight: answer.score_weight,
            user_answer: answer.user_answer,
            is_correct: answer.is_correct,
            score_awarded: answer.score_awarded,
          })),
        score: row.total_score,
        feedback: row.feedback,
        graded_at: row.graded_at,
        status: row.total_score === null ? 'submitted' : 'graded',
      })),
    );
  }
}
