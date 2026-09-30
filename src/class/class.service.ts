import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { assertOwnedAsset } from '../api/file-asset/asset-purpose-rules';
import { assetUrl } from '../common/storage/asset-url';

import { Class } from './entities/class.entity';
import { Chapter } from './entities/chapter.entity';
import { FileResource } from './entities/file-resource.entity';
import { Video } from './entities/video.entity';
import { Meeting } from './entities/meeting.entity';
import { Assignment } from './entities/assignment.entity';
import { AssignmentQuestion } from './entities/assignment-question.entity';
import { ClassMentor } from './entities/class-mentor.entity';
import { Enrollment } from './entities/enrollment.entity';

import { CreateClassDto } from './dto/create-class.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { ClassAccessService } from './class-access.service';
import { ClassListQueryDto } from './dto/class-list-query.dto';
import { ClassResponseDto } from './dto/class-response.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import {
  DEFAULT_TUTOR_PERMISSIONS,
  parsePermissionMatrix,
} from './class-permissions';

// A lead tutor may edit the class's presentation; pricing, type, and status
// stay with the owner.
const LEAD_TUTOR_CLASS_FIELDS = [
  'title',
  'description',
  'cover_asset_id',
  'post_purchase_instructions',
] as const;

const CLASS_UPDATE_FIELDS = [
  ...LEAD_TUTOR_CLASS_FIELDS,
  'type',
  'status',
  'originalPrice',
  'discountedPrice',
] as const;

type ClassUpdateField = (typeof CLASS_UPDATE_FIELDS)[number];

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    @InjectRepository(FileResource) private readonly fileResourceRepo: Repository<FileResource>,
    @InjectRepository(Video) private readonly videoRepo: Repository<Video>,
    @InjectRepository(Meeting) private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AssignmentQuestion) private readonly assignmentQuestionRepo: Repository<AssignmentQuestion>,
    @InjectRepository(ClassMentor) private readonly classMentorRepo: Repository<ClassMentor>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly classAccess: ClassAccessService,
  ) {}

  async createClass(userId: string, merchantId: string, dto: CreateClassDto) {
    assertDiscountWithinPrice(dto.originalPrice, dto.discountedPrice);
    return this.classRepo.manager.transaction(async (manager) => {
      await this.assertOwnsMerchant(userId, merchantId, manager);
      if (dto.cover_asset_id) {
        await assertOwnedAsset(
          manager,
          userId,
          dto.cover_asset_id,
          'class_cover',
        );
      }
      const saved = await manager.save(
        Class,
        manager.create(Class, {
          merchant_id: merchantId,
          title: dto.title,
          description: dto.description,
          status: dto.status,
          type: dto.type,
          originalPrice: dto.originalPrice,
          discountedPrice: dto.discountedPrice,
          cover_asset_id: dto.cover_asset_id ?? null,
          post_purchase_instructions: dto.post_purchase_instructions ?? null,
        }),
      );
      const [data] = await this.toClassResponses([saved], manager);
      return { data, responseMessage: 'Create class success' };
    });
  }

  async getClassesByMerchant(
    userId: string,
    merchantId: string,
    query: ClassListQueryDto,
  ) {
    await this.assertOwnsMerchant(userId, merchantId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const builder = this.classRepo
      .createQueryBuilder('class')
      .where('class.merchant_id = :merchantId', { merchantId });
    if (query.status) {
      builder.andWhere('class.status = :status', { status: query.status });
    }
    if (query.type) {
      builder.andWhere('class.type = :type', { type: query.type });
    }
    const [classes, total] = await builder
      .orderBy('class.created_at', 'DESC')
      .addOrderBy('class.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data: await this.toClassResponses(classes),
      meta: { total, page, limit },
    };
  }

  async getClassById(userId: string, classId: string) {
    await this.classAccess.requireAssigned(userId, classId);
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    const [data] = await this.toClassResponses([cls]);
    return { data, responseMessage: 'Get class detail success' };
  }

  async updateClass(userId: string, classId: string, dto: UpdateClassDto) {
    const changes = pickDefined(dto, CLASS_UPDATE_FIELDS);
    return this.classRepo.manager.transaction(async (manager) => {
      const access = await this.classAccess.resolve(userId, classId, manager);
      if (access.kind === 'tutor') {
        const allowed: readonly ClassUpdateField[] =
          access.role === 'lead' ? LEAD_TUTOR_CLASS_FIELDS : [];
        const denied = Object.keys(changes).filter(
          (field) => !allowed.includes(field as ClassUpdateField),
        );
        if (access.role !== 'lead' || denied.length > 0) {
          throw new ForbiddenException(
            denied.length > 0
              ? `Only the class owner can change: ${denied.join(', ')}`
              : 'Only the class owner or a lead tutor can edit the class',
          );
        }
      }

      const cls = await manager.findOne(Class, {
        where: { id: classId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cls) throw new NotFoundException('Class not found');

      // Checked only when a price changes, so older rows with inverted prices
      // can still be renamed or re-published.
      if ('originalPrice' in changes || 'discountedPrice' in changes) {
        assertDiscountWithinPrice(
          changes.originalPrice ?? cls.originalPrice,
          changes.discountedPrice ?? cls.discountedPrice,
        );
      }
      if (changes.cover_asset_id) {
        await assertOwnedAsset(
          manager,
          userId,
          changes.cover_asset_id,
          'class_cover',
        );
      }

      Object.assign(cls, changes);
      const saved = await manager.save(cls);
      const [data] = await this.toClassResponses([saved], manager);
      return { data, responseMessage: 'Update class success' };
    });
  }

  async createChapter(userId: string, classId: string, dto: CreateChapterDto) {
    await this.classAccess.requireAction(userId, classId, 'materi', 'tambah');
    const chapter = this.chapterRepo.create({
      class_id: classId,
      title: dto.title,
      description: dto.description,
      order: dto.order,
    });
    return this.chapterRepo.save(chapter);
  }

  async getClassChapters(
    userId: string,
    classId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAction(userId, classId, 'materi', 'lihat');
    const [data, total] = await this.chapterRepo.findAndCount({
      where: { class_id: classId },
      relations: ['videos', 'resources'],
      order: { order: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Transform resources to files for the response
    const transformedData = data.map((chapter) => ({
      ...chapter,
      files: chapter.resources || [],
      resources: undefined, // Remove the original resources field
    }));

    return { data: transformedData, meta: { total, page, limit } };
  }

  async addResources(
    userId: string,
    classId: string,
    chapterId: string,
    resourcesData: { type: string; name: string; url: string }[],
  ) {
    await this.classAccess.requireAction(userId, classId, 'materi', 'tambah');
    const chapter = await this.chapterRepo.findOne({
      where: { id: chapterId, class_id: classId },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const resources = resourcesData.map((res) => {
      return this.fileResourceRepo.create({
        chapter_id: chapterId,
        type: res.type as any,
        name: res.name,
        url: res.url,
      });
    });

    await this.fileResourceRepo.save(resources);
    return resources;
  }

  async createMeeting(userId: string, classId: string, dto: CreateMeetingDto) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'tambah');
    const meeting = this.meetingRepo.create({
      class_id: classId,
      title: dto.title,
      content: dto.content,
      date: dto.date,
      time: dto.time,
      liveUrl: dto.liveUrl,
    });
    return this.meetingRepo.save(meeting);
  }

  async getClassMeetings(
    userId: string,
    classId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'lihat');
    const [data, total] = await this.meetingRepo.findAndCount({ 
      where: { class_id: classId },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  async createAssignment(
    userId: string,
    classId: string,
    dto: CreateAssignmentDto,
  ) {
    await this.classAccess.requireAction(userId, classId, 'tugas', 'tambah');
    const { questions } = dto;
    const assignment = this.assignmentRepo.create({
      class_id: classId,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      due: new Date(dto.due),
    });

    const savedAssignment = await this.assignmentRepo.save(assignment);

    if (questions && questions.length > 0) {
      const qs = questions.map((q) =>
        this.assignmentQuestionRepo.create({
          assignment_id: savedAssignment.id,
          question_text: q.question_text,
          type: q.type,
          options: q.options,
          correct_answer: q.correct_answer,
          score_weight: q.score_weight,
        }),
      );
      await this.assignmentQuestionRepo.save(qs);
    }

    return savedAssignment;
  }

  async getClassAssignments(
    userId: string,
    classId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAssigned(userId, classId);
    const [data, total] = await this.assignmentRepo.findAndCount({
      where: { class_id: classId },
      relations: ['questions'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  // Only the owner of the class's merchant may invite, and only an active
  // mentor account. The class row lock serializes concurrent invites so one
  // mentor cannot be assigned twice.
  async inviteMentor(userId: string, classId: string, dto: InviteMentorDto) {
    return this.classMentorRepo.manager.transaction(async (manager) => {
      const [ownedClass] = await manager.query(
        `SELECT class.id
         FROM classes class
         INNER JOIN merchants merchant
           ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
         WHERE class.id = $1 AND class.deleted_at IS NULL AND merchant.user_id = $2
         FOR UPDATE OF class`,
        [classId, userId],
      );
      if (!ownedClass) {
        throw new NotFoundException('Class not found');
      }

      const [mentor] = await manager.query(
        `SELECT mentor.id
         FROM mentors mentor
         INNER JOIN users mentor_user
           ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
         WHERE lower(mentor_user.email) = lower($1)
           AND mentor.status = 'active' AND mentor.deleted_at IS NULL`,
        [dto.email.trim()],
      );
      if (!mentor) {
        throw new NotFoundException('No active mentor account uses this email');
      }

      const assigned = await manager.findOne(ClassMentor, {
        where: { class_id: classId, mentor_id: mentor.id },
      });
      if (assigned) {
        throw new ConflictException('Mentor is already assigned to this class');
      }

      return manager.save(
        ClassMentor,
        manager.create(ClassMentor, {
          class_id: classId,
          mentor_id: mentor.id,
          role: dto.role,
          permissions: dto.permissions
            ? parsePermissionMatrix(dto.permissions)
            : DEFAULT_TUTOR_PERMISSIONS[dto.role],
        }),
      );
    });
  }

  async getClassMentors(userId: string, classId: string, page = 1, limit = 10) {
    await this.classAccess.requireAssigned(userId, classId);
    const [data, total] = await this.classMentorRepo.findAndCount({
      where: { class_id: classId },
      relations: ['mentor'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  // Projects only enrollment columns and public user fields; loading the
  // User entity would serialize its password hash.
  async getClassStudents(
    userId: string,
    classId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAssigned(userId, classId);
    const query = this.enrollmentRepo
      .createQueryBuilder('enrollment')
      .innerJoin('enrollment.user', 'student')
      .where('enrollment.class_id = :classId', { classId });
    const total = await query.getCount();
    const rows = await query
      .select([
        'enrollment.id AS id',
        'enrollment.user_id AS user_id',
        'enrollment.class_id AS class_id',
        'enrollment."joinDate" AS "joinDate"',
        'enrollment.progress AS progress',
        'enrollment.created_at AS created_at',
        'student.id AS student_id',
        'student.name AS student_name',
        'student.email AS student_email',
      ])
      .orderBy('enrollment.created_at', 'ASC')
      .addOrderBy('enrollment.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const data = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      class_id: row.class_id,
      joinDate: row.joinDate,
      progress: row.progress,
      created_at: row.created_at,
      user: {
        id: row.student_id,
        name: row.student_name,
        email: row.student_email,
      },
    }));
    return { data, meta: { total, page, limit } };
  }

  private async toClassResponses(
    classes: Class[],
    manager: EntityManager = this.classRepo.manager,
  ): Promise<ClassResponseDto[]> {
    const coverIds = classes
      .map((cls) => cls.cover_asset_id)
      .filter((id): id is string => Boolean(id));
    const covers: { id: string; object_key: string }[] =
      coverIds.length === 0
        ? []
        : await manager.query(
            `SELECT id, object_key FROM file_assets
             WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
            [coverIds],
          );
    const coverKeys = new Map(
      covers.map((cover) => [cover.id, cover.object_key]),
    );

    return classes.map((cls) => ({
      id: cls.id,
      merchant_id: cls.merchant_id,
      title: cls.title,
      description: cls.description,
      status: cls.status,
      type: cls.type,
      originalPrice: cls.originalPrice,
      discountedPrice: cls.discountedPrice,
      cover_asset_id: cls.cover_asset_id,
      cover_url: assetUrl(coverKeys.get(cls.cover_asset_id ?? '')),
      post_purchase_instructions: cls.post_purchase_instructions,
      created_at: cls.created_at,
      updated_at: cls.updated_at,
    }));
  }

  private async assertOwnsMerchant(
    userId: string,
    merchantId: string,
    manager: EntityManager = this.classRepo.manager,
  ) {
    const owned = await manager.query(
      `SELECT 1 FROM merchants
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [merchantId, userId],
    );
    if (owned.length === 0) throw new NotFoundException('Merchant not found');
  }
}

// originalPrice is the strikethrough price and discountedPrice the selling
// price, so a set discount may not exceed the list price.
function assertDiscountWithinPrice(
  originalPrice: number | null | undefined,
  discountedPrice: number | null | undefined,
): void {
  if (discountedPrice && discountedPrice > (originalPrice ?? 0)) {
    throw new BadRequestException(
      'discountedPrice must not exceed originalPrice',
    );
  }
}

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const picked: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}
