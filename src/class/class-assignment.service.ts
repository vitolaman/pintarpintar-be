import {
  BadRequestException,
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
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { Assignment, AssignmentType } from './entities/assignment.entity';
import {
  AssignmentQuestion,
  QuestionType,
} from './entities/assignment-question.entity';

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
    assertAssignmentContent(dto.type, dto.due, questions);

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
      // Questions have no order column; they are listed by created_at, and
      // rows inserted in one transaction would share now(). Stamping them 1 ms
      // apart keeps the author's order.
      const createdAt = Date.now();
      await manager.save(
        AssignmentQuestion,
        questions.map((question, index) =>
          manager.create(AssignmentQuestion, {
            assignment_id: assignment.id,
            question_text: question.question_text,
            type: question.type,
            options:
              question.type === QuestionType.MULTIPLE_CHOICE
                ? question.options
                : null,
            correct_answer: question.correct_answer ?? null,
            score_weight: question.score_weight ?? 0,
            created_at: new Date(createdAt + index),
            created_by: userId,
          }),
        ),
      );

      const [data] = await this.toResponses(manager, [assignment], access);
      return { data, responseMessage: 'Create assignment success' };
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
      meta: { total, page, limit },
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

// Rules spanning several fields, checked before anything is written.
function assertAssignmentContent(
  type: AssignmentType,
  due: string,
  questions: CreateAssignmentDto['questions'] & object,
): void {
  if (new Date(due).getTime() <= Date.now()) {
    throw new BadRequestException('due must be in the future');
  }
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
