import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import {
  DEFAULT_TUTOR_PERMISSIONS,
  parsePermissionMatrix,
} from './class-permissions';

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
  ) {}

  async createClass(userId: string, merchantId: string, dto: CreateClassDto) {
    await this.assertOwnsMerchant(userId, merchantId);
    const newClass = this.classRepo.create({
      merchant_id: merchantId,
      title: dto.title,
      description: dto.description,
      status: dto.status,
      type: dto.type,
      originalPrice: dto.originalPrice,
      discountedPrice: dto.discountedPrice,
    });
    return this.classRepo.save(newClass);
  }

  async getClassesByMerchant(
    userId: string,
    merchantId: string,
    page: any = 1,
    limit: any = 10,
    status?: string,
  ) {
    await this.assertOwnsMerchant(userId, merchantId);
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const query = this.classRepo.createQueryBuilder('class')
      .where('class.merchant_id = :merchantId', { merchantId });

    if (status) {
      query.andWhere('class.status = :status', { status });
    }
    const [data, total] = await query
      .skip((pageNum - 1) * limitNum)
      .take(limitNum)
      .getManyAndCount();
    return {
      data,
      meta: { total, page: pageNum, limit: limitNum },
    };
  }

  async getClassById(userId: string, classId: string) {
    await this.assertClassAccess(userId, classId, 'view');
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async createChapter(userId: string, classId: string, dto: CreateChapterDto) {
    await this.assertClassAccess(userId, classId, 'manage');
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
    await this.assertClassAccess(userId, classId, 'view');
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
    await this.assertClassAccess(userId, classId, 'manage');
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
    await this.assertClassAccess(userId, classId, 'manage');
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
    await this.assertClassAccess(userId, classId, 'view');
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
    await this.assertClassAccess(userId, classId, 'manage');
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
    await this.assertClassAccess(userId, classId, 'view');
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
    await this.assertClassAccess(userId, classId, 'view');
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
    await this.assertClassAccess(userId, classId, 'view');
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

  // Classes the caller may not access are hidden behind 404: the owner of the
  // class's merchant may manage it, and its active assigned mentors may view it.
  private async assertClassAccess(
    userId: string,
    classId: string,
    access: 'manage' | 'view',
  ) {
    const [row] = await this.classRepo.manager.query(
      `SELECT merchant.user_id = $2 AS is_owner,
              EXISTS (
                SELECT 1 FROM class_mentors link
                INNER JOIN mentors mentor
                  ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
                  AND mentor.status = 'active'
                WHERE link.class_id = class.id AND link.deleted_at IS NULL
                  AND mentor.user_id = $2
              ) AS is_mentor
       FROM classes class
       INNER JOIN merchants merchant
         ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
       WHERE class.id = $1 AND class.deleted_at IS NULL`,
      [classId, userId],
    );
    const allowed =
      row && (row.is_owner || (access === 'view' && row.is_mentor));
    if (!allowed) throw new NotFoundException('Class not found');
  }

  private async assertOwnsMerchant(userId: string, merchantId: string) {
    const owned = await this.classRepo.manager.query(
      `SELECT 1 FROM merchants
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [merchantId, userId],
    );
    if (owned.length === 0) throw new NotFoundException('Merchant not found');
  }
}
