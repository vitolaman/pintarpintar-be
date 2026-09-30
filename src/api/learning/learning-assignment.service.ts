import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { LearnerAccessService } from '../../class/learner-access.service';
import { loadLearnerMetrics } from '../../class/learner-metrics';
import {
  ObjectStorage,
  createObjectStorage,
} from '../../common/storage/object-storage';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';
import {
  LearnerAssignmentDto,
  LearnerGradesDto,
  LearnerQuizDto,
  LearnerSubmissionDto,
} from './dto/learning-assignment.dto';

interface AssignmentRow {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  type: string;
  due: Date | null;
  resource_name: string | null;
  resource_size: string | null;
  resource_object_key: string | null;
  question_count: number;
  total_weight: number;
  submission_id: string | null;
  submitted_at: Date | null;
  is_late: boolean | null;
  file_name: string | null;
  total_score: number | null;
  feedback: string | null;
}

// Learners see assignments of their class and their own latest attempt.
// Answer keys are never selected here.
const ASSIGNMENTS_SQL = `
  SELECT assignment.id, assignment.class_id, assignment.title, assignment.description,
         assignment.type, assignment.due,
         resource.original_filename AS resource_name, resource.size_bytes AS resource_size,
         resource.object_key AS resource_object_key,
         (SELECT count(*)::integer FROM assignment_questions question
          WHERE question.assignment_id = assignment.id AND question.deleted_at IS NULL) AS question_count,
         (SELECT COALESCE(sum(question.score_weight), 0)::integer FROM assignment_questions question
          WHERE question.assignment_id = assignment.id AND question.deleted_at IS NULL) AS total_weight,
         submission.id AS submission_id, submission."submissionDate" AS submitted_at,
         submission.is_late, submission."fileName" AS file_name, submission.total_score,
         submission.feedback
  FROM assignments assignment
  LEFT JOIN file_assets resource
    ON resource.id = assignment.resource_asset_id AND resource.deleted_at IS NULL
  LEFT JOIN submissions submission
    ON submission.assignment_id = assignment.id AND submission.user_id = $2
    AND submission.deleted_at IS NULL
  WHERE assignment.deleted_at IS NULL
`;

@Injectable()
export class LearningAssignmentService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly learnerAccess: LearnerAccessService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findAssignments(userId: string, classId: string) {
    await this.learnerAccess.requireEnrollment(userId, classId);
    const rows: AssignmentRow[] = await this.dataSource.query(
      `${ASSIGNMENTS_SQL} AND assignment.class_id = $1
       ORDER BY assignment.due NULLS LAST, assignment.created_at, assignment.id`,
      [classId, userId],
    );
    return {
      data: await Promise.all(rows.map((row) => this.toAssignment(row))),
      responseMessage: 'Get learning assignments success',
    };
  }

  // Participation is the attendance percentage, shown only once the class
  // has a meeting that has started; the average covers graded work only.
  async findGrades(userId: string, classId: string) {
    await this.learnerAccess.requireEnrollment(userId, classId);
    const manager = this.dataSource.manager;
    const [rows, [metrics]] = await Promise.all([
      manager.query(
        `${ASSIGNMENTS_SQL} AND assignment.class_id = $1
         ORDER BY assignment.due NULLS LAST, assignment.created_at, assignment.id`,
        [classId, userId],
      ) as Promise<AssignmentRow[]>,
      loadLearnerMetrics(manager, classId, [userId]),
    ]);
    const data: LearnerGradesDto = {
      class_id: classId,
      assignments: rows.map((row) => ({
        assignment_id: row.id,
        title: row.title,
        type: row.type,
        due: row.due,
        score: row.total_score,
        feedback: row.feedback,
        status: row.submission_id
          ? row.total_score === null
            ? 'submitted'
            : 'graded'
          : 'not_submitted',
      })),
      participation: metrics?.attendance_percent ?? null,
      average_score: metrics?.average_score ?? null,
    };
    return { data, responseMessage: 'Get learning grades success' };
  }

  async findQuiz(userId: string, assignmentId: string) {
    const manager = this.dataSource.manager;
    const row = await this.findLearnerAssignment(manager, userId, assignmentId);
    if (row.type !== 'quiz') throw new NotFoundException('Quiz not found');

    const questions = await manager.query(
      `SELECT id, question_text, type, options, score_weight
       FROM assignment_questions
       WHERE assignment_id = $1 AND deleted_at IS NULL
       ORDER BY created_at, id`,
      [assignmentId],
    );
    const data: LearnerQuizDto = {
      ...(await this.toAssignment(row)),
      questions,
    };
    return { data, responseMessage: 'Get quiz success' };
  }

  // Resolves an assignment the learner may see: 404 for unknown or deleted
  // assignments and for classes the learner is not enrolled in.
  async findLearnerAssignment(
    manager: EntityManager,
    userId: string,
    assignmentId: string,
  ): Promise<AssignmentRow> {
    const [row] = await manager.query(
      `${ASSIGNMENTS_SQL} AND assignment.id = $1`,
      [assignmentId, userId],
    );
    if (!row) throw new NotFoundException('Assignment not found');
    await this.learnerAccess.requireEnrollment(userId, row.class_id, manager);
    return row;
  }

  async toAssignment(row: AssignmentRow): Promise<LearnerAssignmentDto> {
    return {
      id: row.id,
      class_id: row.class_id,
      title: row.title,
      description: row.description,
      type: row.type,
      due: row.due,
      is_past_due: row.due !== null && new Date(row.due).getTime() < Date.now(),
      question_count: row.question_count,
      total_weight: row.total_weight,
      resource: row.resource_object_key
        ? {
            name: row.resource_name,
            size: Number(row.resource_size),
            download_url: await signedDownloadUrl(
              this.storage,
              row.resource_object_key,
              row.resource_name,
            ),
          }
        : null,
      my_submission: toSubmission(row),
    };
  }
}

function toSubmission(row: AssignmentRow): LearnerSubmissionDto | null {
  if (!row.submission_id) return null;
  return {
    id: row.submission_id,
    submitted_at: row.submitted_at,
    is_late: row.is_late === true,
    file_name: row.file_name,
    score: row.total_score,
    feedback: row.feedback,
    status: row.total_score === null ? 'submitted' : 'graded',
  };
}
