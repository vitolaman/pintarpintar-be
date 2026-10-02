import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { assertOwnedAsset } from '../api/file-asset/asset-purpose-rules';
import {
  ObjectStorage,
  createObjectStorage,
} from '../common/storage/object-storage';
import { signedDownloadUrl } from '../common/storage/signed-download-url';
import { ClassAccess, ClassAccessService } from './class-access.service';
import { CLASS_ACTIONS } from './class-permissions';
import { AssignmentResponseDto } from './dto/class-response.dto';
import {
  CreateAssignmentDto,
  CreateQuestionDto,
} from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Assignment, AssignmentType } from './entities/assignment.entity';
import {
  AssignmentQuestion,
  QuestionType,
} from './entities/assignment-question.entity';
import { paginationMeta } from '../common/dto/response-meta.dto';

@Injectable()
export class ClassAssignmentService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async createAssignment(
    userId: string,
    classId: string,
    dto: CreateAssignmentDto,
  ) {
    const questions = dto.questions ?? [];
    assertDueInFuture(dto.due);
    assertQuestionContent(dto.type, questions);

    return this.dataSource.transaction(async (manager) => {
      const access = await this.classAccess.requireAction(
        userId,
        classId,
        'tugas',
        'tambah',
        manager,
      );
      if (dto.resource_asset_id) {
        await assertOwnedAsset(
          manager,
          userId,
          dto.resource_asset_id,
          'assignment_resource',
          { classId },
        );
      }

      const assignment = await manager.save(
        Assignment,
        manager.create(Assignment, {
          class_id: classId,
          title: dto.title,
          description: dto.description,
          type: dto.type,
          due: new Date(dto.due),
          resource_asset_id: dto.resource_asset_id ?? null,
          created_by: userId,
        }),
      );
      await saveQuestions(manager, assignment.id, questions, userId);

      const [data] = await this.toResponses(manager, [assignment], access);
      return { data, responseMessage: 'Create assignment success' };
    });
  }

  // Submissions are kept. Once a learner has submitted, the type and the quiz
  // questions are fixed: stored answers point at the questions, and their
  // scores were computed from those options, answer keys and weights.
  async updateAssignment(
    userId: string,
    classId: string,
    assignmentId: string,
    dto: UpdateAssignmentDto,
  ) {
    if (dto.due !== undefined) assertDueInFuture(dto.due);

    return this.dataSource.transaction(async (manager) => {
      const access = await this.classAccess.requireAction(
        userId,
        classId,
        'tugas',
        'edit',
        manager,
      );
      // Learner attempts lock this row FOR KEY SHARE, so the edit waits for
      // an attempt in progress and holds back new ones until it commits.
      const assignment = await manager.findOne(Assignment, {
        where: { id: assignmentId, class_id: classId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assignment) throw new NotFoundException('Assignment not found');

      const type = dto.type ?? assignment.type;
      const currentQuestions = await manager.find(AssignmentQuestion, {
        where: { assignment_id: assignmentId },
        order: { created_at: 'ASC', id: 'ASC' },
      });
      if (dto.questions !== undefined) {
        assertQuestionContent(type, dto.questions);
      } else if (
        type === AssignmentType.QUIZ &&
        currentQuestions.length === 0
      ) {
        throw new BadRequestException('A quiz needs at least one question');
      }

      const typeChanged = type !== assignment.type;
      const replacementQuestions =
        typeChanged && type === AssignmentType.FILE_UPLOAD
          ? questionReplacement(currentQuestions, [])
          : questionReplacement(currentQuestions, dto.questions);
      if (typeChanged || replacementQuestions) {
        await this.assertNoSubmissions(
          manager,
          assignmentId,
          typeChanged
            ? 'The assignment type cannot change once learners have submitted'
            : 'Quiz questions cannot change once learners have submitted',
        );
      }

      if (
        dto.resource_asset_id &&
        dto.resource_asset_id !== assignment.resource_asset_id
      ) {
        await assertOwnedAsset(
          manager,
          userId,
          dto.resource_asset_id,
          'assignment_resource',
          { classId },
        );
      }

      if (dto.title !== undefined) assignment.title = dto.title;
      if (dto.description !== undefined) {
        assignment.description = dto.description;
      }
      if (dto.due !== undefined) assignment.due = new Date(dto.due);
      if (dto.resource_asset_id !== undefined) {
        assignment.resource_asset_id = dto.resource_asset_id;
      }
      assignment.type = type;
      assignment.updated_by = userId;
      const saved = await manager.save(Assignment, assignment);

      if (replacementQuestions) {
        await manager.update(
          AssignmentQuestion,
          { assignment_id: assignmentId, deleted_at: IsNull() },
          { deleted_at: new Date(), deleted_by: userId },
        );
        await saveQuestions(
          manager,
          assignmentId,
          replacementQuestions,
          userId,
        );
      }

      const [data] = await this.toResponses(manager, [saved], access);
      return { data, responseMessage: 'Update assignment success' };
    });
  }

  // Any assigned tutor may see the list; answer keys stay with the owner and
  // tutors who work on tasks or grades.
  async getAssignments(userId: string, classId: string, page = 1, limit = 10) {
    const access = await this.classAccess.requireAssigned(userId, classId);
    const manager = this.dataSource.manager;
    const [assignments, total] = await manager.findAndCount(Assignment, {
      where: { class_id: classId },
      order: { due: 'ASC', created_at: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: await this.toResponses(manager, assignments, access),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get class assignments success',
    };
  }

  async deleteAssignment(
    userId: string,
    classId: string,
    assignmentId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'tugas',
        'delete',
        manager,
      );
      const assignment = await manager.findOne(Assignment, {
        where: { id: assignmentId, class_id: classId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assignment) throw new NotFoundException('Assignment not found');

      const deletion = { deleted_at: new Date(), deleted_by: userId };
      await manager.update(
        AssignmentQuestion,
        { assignment_id: assignmentId, deleted_at: IsNull() },
        deletion,
      );
      await manager.update(Assignment, { id: assignmentId }, deletion);
    });
  }

  private async assertNoSubmissions(
    manager: EntityManager,
    assignmentId: string,
    message: string,
  ): Promise<void> {
    const submitted = await manager.query(
      `SELECT 1 FROM submissions
       WHERE assignment_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [assignmentId],
    );
    if (submitted.length > 0) throw new ConflictException(message);
  }

  private async loadResourceAssets(
    manager: EntityManager,
    assetIds: string[],
  ): Promise<ResourceAsset[]> {
    if (assetIds.length === 0) return [];
    return manager.query(
      `SELECT id, object_key, original_filename, size_bytes
       FROM file_assets
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [assetIds],
    );
  }

  private async toResponses(
    manager: EntityManager,
    assignments: Assignment[],
    access: ClassAccess,
  ): Promise<AssignmentResponseDto[]> {
    if (assignments.length === 0) return [];
    const ids = assignments.map((assignment) => assignment.id);
    const resourceIds = assignments
      .map((assignment) => assignment.resource_asset_id)
      .filter((id): id is string => Boolean(id));

    const [questions, submissionCounts, resources] = await Promise.all([
      manager.find(AssignmentQuestion, {
        where: { assignment_id: In(ids) },
        order: { created_at: 'ASC', id: 'ASC' },
      }),
      manager.query(
        `SELECT assignment_id, count(DISTINCT user_id)::integer AS count
         FROM submissions
         WHERE assignment_id = ANY($1::uuid[]) AND deleted_at IS NULL
         GROUP BY assignment_id`,
        [ids],
      ) as Promise<{ assignment_id: string; count: number }[]>,
      this.loadResourceAssets(manager, resourceIds),
    ]);
    const countByAssignment = new Map(
      submissionCounts.map((row) => [row.assignment_id, row.count]),
    );
    const resourceById = new Map(resources.map((asset) => [asset.id, asset]));
    const showAnswers = canSeeAnswers(access);

    return Promise.all(
      assignments.map(async (assignment) => {
        const resource = assignment.resource_asset_id
          ? resourceById.get(assignment.resource_asset_id)
          : undefined;
        return {
          id: assignment.id,
          class_id: assignment.class_id,
          title: assignment.title,
          description: assignment.description,
          due: assignment.due,
          type: assignment.type,
          resource: resource
            ? {
                asset_id: resource.id,
                name: resource.original_filename,
                size: Number(resource.size_bytes),
                download_url: await signedDownloadUrl(
                  this.storage,
                  resource.object_key,
                  resource.original_filename,
                ),
              }
            : null,
          submission_count: countByAssignment.get(assignment.id) ?? 0,
          questions: questions
            .filter((question) => question.assignment_id === assignment.id)
            .map((question) => ({
              id: question.id,
              question_text: question.question_text,
              type: question.type,
              options: question.options,
              score_weight: question.score_weight,
              ...(showAnswers
                ? { correct_answer: question.correct_answer }
                : {}),
            })),
          created_at: assignment.created_at,
        };
      }),
    );
  }
}

type ResourceAsset = {
  id: string;
  object_key: string;
  original_filename: string;
  size_bytes: string;
};

function canSeeAnswers(access: ClassAccess): boolean {
  if (access.kind === 'owner') return true;
  return (['tugas', 'nilai'] as const).some((area) =>
    CLASS_ACTIONS.some((action) => access.permissions?.[area]?.[action]),
  );
}

type QuestionContent = Pick<
  CreateQuestionDto,
  'question_text' | 'type' | 'options' | 'correct_answer' | 'score_weight'
>;

// Questions have no order column; they are listed by created_at, and rows
// inserted in one transaction would share now(). Stamping them 1 ms apart
// keeps the author's order.
async function saveQuestions(
  manager: EntityManager,
  assignmentId: string,
  questions: QuestionContent[],
  userId: string,
): Promise<void> {
  const createdAt = Date.now();
  await manager.save(
    AssignmentQuestion,
    questions.map((question, index) =>
      manager.create(AssignmentQuestion, {
        assignment_id: assignmentId,
        ...normalizedQuestion(question),
        created_at: new Date(createdAt + index),
        created_by: userId,
      }),
    ),
  );
}

function normalizedQuestion(question: QuestionContent) {
  return {
    question_text: question.question_text,
    type: question.type,
    options:
      question.type === QuestionType.MULTIPLE_CHOICE
        ? (question.options ?? null)
        : null,
    correct_answer: question.correct_answer ?? null,
    score_weight: question.score_weight ?? 0,
  };
}

// The questions to store instead of the current ones, or undefined when they
// stay. Resending the current questions unchanged keeps them, so a full form
// can be saved after learners have submitted.
function questionReplacement(
  current: QuestionContent[],
  sent: QuestionContent[] | undefined,
): QuestionContent[] | undefined {
  if (sent === undefined) return undefined;
  const unchanged =
    JSON.stringify(current.map(normalizedQuestion)) ===
    JSON.stringify(sent.map(normalizedQuestion));
  return unchanged ? undefined : sent;
}

function assertDueInFuture(due: string): void {
  if (new Date(due).getTime() <= Date.now()) {
    throw new BadRequestException('due must be in the future');
  }
}

// Rules spanning several fields, checked before anything is written.
function assertQuestionContent(
  type: AssignmentType,
  questions: QuestionContent[],
): void {
  if (type === AssignmentType.QUIZ && questions.length === 0) {
    throw new BadRequestException('A quiz needs at least one question');
  }
  if (type === AssignmentType.FILE_UPLOAD && questions.length > 0) {
    throw new BadRequestException('Only quizzes have questions');
  }
  questions.forEach((question, index) => {
    if (
      question.type === QuestionType.MULTIPLE_CHOICE &&
      !question.options?.includes(question.correct_answer ?? '')
    ) {
      throw new BadRequestException(
        `questions[${index}].correct_answer must be one of its options`,
      );
    }
  });
}
