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
import { assertDiscountWithinPrice } from '../common/pricing/discount-rule';

import { Class, ClassType } from './entities/class.entity';
import { Meeting } from './entities/meeting.entity';
import { ClassMentor } from './entities/class-mentor.entity';
import { Enrollment } from './entities/enrollment.entity';

import { CreateClassDto } from './dto/create-class.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { ClassAccessService } from './class-access.service';
import { ClassCertificateService } from './class-certificate.service';
import { ClassListQueryDto } from './dto/class-list-query.dto';
import {
  ClassResponseDto,
  MeetingResponseDto,
  ClassTutorResponseDto,
} from './dto/class-response.dto';
import { UpdateClassMentorDto } from './dto/update-class-mentor.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import {
  DEFAULT_TUTOR_PERMISSIONS,
  parsePermissionMatrix,
} from './class-permissions';
import {
  BOOTCAMP_MEETING_SQL,
  MEETING_MENTOR_JOIN_SQL,
  MEETING_MENTOR_SQL,
  MEETING_STATUS_SQL,
} from './meeting-sql';

// A lead tutor may edit the class's presentation; pricing, type, and status
// stay with the owner.
const LEAD_TUTOR_CLASS_FIELDS = [
  'title',
  'description',
  'cover_asset_id',
  'post_purchase_instructions',
  'category',
  'level',
  'duration',
  'prerequisites',
  'learning_outcomes',
] as const;

const CLASS_UPDATE_FIELDS = [
  ...LEAD_TUTOR_CLASS_FIELDS,
  'type',
  'status',
  'originalPrice',
  'discountedPrice',
] as const;

type ClassUpdateField = (typeof CLASS_UPDATE_FIELDS)[number];

const CLASS_PRICE_FIELDS = {
  list: 'originalPrice',
  discount: 'discountedPrice',
};

const MEETING_UPDATE_FIELDS = [
  'title',
  'content',
  'date',
  'time',
  'liveUrl',
  'duration_minutes',
  'mentor_id',
] as const;

const MEETING_RESPONSE_SQL = `
  SELECT meeting.id, meeting.class_id, meeting.title, meeting.content,
         meeting."date"::text AS date, to_char(meeting."time", 'HH24:MI') AS time,
         meeting."liveUrl" AS "liveUrl", ${MEETING_STATUS_SQL} AS status,
         meeting.duration_minutes, ${MEETING_MENTOR_SQL} AS mentor, meeting.created_at
  FROM meetings meeting
  ${BOOTCAMP_MEETING_SQL}
  ${MEETING_MENTOR_JOIN_SQL}
  WHERE meeting.class_id = $1 AND meeting.deleted_at IS NULL`;

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(ClassMentor)
    private readonly classMentorRepo: Repository<ClassMentor>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly classAccess: ClassAccessService,
    private readonly certificates: ClassCertificateService,
  ) {}

  async createClass(userId: string, merchantId: string, dto: CreateClassDto) {
    assertDiscountWithinPrice(
      dto.originalPrice,
      dto.discountedPrice,
      CLASS_PRICE_FIELDS,
    );
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
          category: dto.category ?? null,
          level: dto.level ?? null,
          duration: dto.duration ?? null,
          prerequisites: dto.prerequisites ?? null,
          learning_outcomes: dto.learning_outcomes ?? null,
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
          CLASS_PRICE_FIELDS,
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
      // Meetings exist only for live bootcamps. Meeting writes lock this row
      // too, so none can be added while the type changes.
      if (changes.type === ClassType.VIDEO && cls.type !== ClassType.VIDEO) {
        const meetings = await manager.count(Meeting, {
          where: { class_id: classId },
        });
        if (meetings > 0) {
          throw new BadRequestException(
            'A live bootcamp that has meetings cannot become a video class',
          );
        }
      }

      Object.assign(cls, changes);
      const saved = await manager.save(cls);
      const [data] = await this.toClassResponses([saved], manager);
      return { data, responseMessage: 'Update class success' };
    });
  }

  async createMeeting(userId: string, classId: string, dto: CreateMeetingDto) {
    return this.meetingRepo.manager.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'meeting',
        'tambah',
        manager,
      );
      await this.lockBootcamp(manager, classId);
      if (dto.mentor_id) {
        await this.assertClassTutor(manager, classId, dto.mentor_id);
      }
      const meeting = await manager.save(
        manager.create(Meeting, {
          class_id: classId,
          title: dto.title,
          content: dto.content,
          date: dto.date,
          time: dto.time,
          liveUrl: dto.liveUrl,
          duration_minutes: dto.duration_minutes ?? null,
          mentor_id: dto.mentor_id ?? null,
          created_by: userId,
        }),
      );
      return {
        data: await this.findMeetingResponse(manager, classId, meeting.id),
        responseMessage: 'Create meeting success',
      };
    });
  }

  async updateMeeting(
    userId: string,
    classId: string,
    meetingId: string,
    dto: UpdateMeetingDto,
  ) {
    return this.meetingRepo.manager.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'meeting',
        'edit',
        manager,
      );
      await this.lockBootcamp(manager, classId);
      const meeting = await manager.findOne(Meeting, {
        where: { id: meetingId, class_id: classId },
      });
      if (!meeting) throw new NotFoundException('Meeting not found');
      if (dto.mentor_id) {
        await this.assertClassTutor(manager, classId, dto.mentor_id);
      }

      Object.assign(meeting, pickDefined(dto, MEETING_UPDATE_FIELDS));
      meeting.updated_by = userId;
      await manager.save(meeting);
      return {
        data: await this.findMeetingResponse(manager, classId, meeting.id),
        responseMessage: 'Update meeting success',
      };
    });
  }

  // Soft delete: the meeting's attendance stops counting, so learners who
  // only missed this meeting may now qualify for an automatic certificate.
  // Leftover meetings of video classes can be removed too.
  async deleteMeeting(userId: string, classId: string, meetingId: string) {
    await this.meetingRepo.manager.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'meeting',
        'delete',
        manager,
      );
      await manager.query(
        'SELECT id FROM classes WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
        [classId],
      );
      const meeting = await manager.findOne(Meeting, {
        where: { id: meetingId, class_id: classId },
      });
      if (!meeting) throw new NotFoundException('Meeting not found');

      await manager.update(
        Meeting,
        { id: meeting.id },
        { deleted_at: new Date(), deleted_by: userId },
      );
      await this.certificates.issueEligible(manager, classId);
    });
  }

  async getClassMeetings(
    userId: string,
    classId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'lihat');
    const manager = this.meetingRepo.manager;
    const [data, [{ total }]] = await Promise.all([
      manager.query(
        `${MEETING_RESPONSE_SQL}
         ORDER BY meeting."date" ASC, meeting."time" ASC, meeting.id ASC
         LIMIT $2 OFFSET $3`,
        [classId, limit, (page - 1) * limit],
      ) as Promise<MeetingResponseDto[]>,
      manager.query(
        `SELECT count(*)::integer AS total FROM meetings meeting
         ${BOOTCAMP_MEETING_SQL}
         WHERE meeting.class_id = $1 AND meeting.deleted_at IS NULL`,
        [classId],
      ),
    ]);
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

      const link = await manager.save(
        ClassMentor,
        manager.create(ClassMentor, {
          class_id: classId,
          mentor_id: mentor.id,
          role: dto.role,
          permissions: dto.permissions
            ? parsePermissionMatrix(dto.permissions)
            : DEFAULT_TUTOR_PERMISSIONS[dto.role],
          created_by: userId,
        }),
      );
      const [data] = await this.loadTutors(manager, classId, {
        linkId: link.id,
      });
      return { data, responseMessage: 'Invite mentor success' };
    });
  }

  // Only the owner changes a tutor; the new role's preset applies unless a
  // complete matrix is sent.
  async updateClassMentor(
    userId: string,
    classId: string,
    classMentorId: string,
    dto: UpdateClassMentorDto,
  ) {
    return this.classRepo.manager.transaction(async (manager) => {
      const link = await this.lockTutorLink(
        manager,
        userId,
        classId,
        classMentorId,
      );
      if (dto.role !== undefined) {
        link.role = dto.role;
      }
      if (dto.permissions !== undefined) {
        link.permissions = parsePermissionMatrix(dto.permissions);
      } else if (dto.role !== undefined) {
        link.permissions = DEFAULT_TUTOR_PERMISSIONS[dto.role];
      }
      link.updated_by = userId;
      await manager.save(link);

      const [data] = await this.loadTutors(manager, classId, {
        linkId: link.id,
      });
      return { data, responseMessage: 'Update class mentor success' };
    });
  }

  // A revoked tutor loses access immediately: class access only follows
  // non-deleted links.
  async revokeClassMentor(
    userId: string,
    classId: string,
    classMentorId: string,
  ) {
    await this.classRepo.manager.transaction(async (manager) => {
      const link = await this.lockTutorLink(
        manager,
        userId,
        classId,
        classMentorId,
      );
      await manager.update(
        ClassMentor,
        { id: link.id },
        { deleted_at: new Date(), deleted_by: userId },
      );
    });
  }

  async getClassMentors(userId: string, classId: string, page = 1, limit = 10) {
    await this.classAccess.requireAssigned(userId, classId);
    const manager = this.classRepo.manager;
    const [{ total }] = await manager.query(
      `SELECT count(*)::integer AS total FROM class_mentors
       WHERE class_id = $1 AND deleted_at IS NULL`,
      [classId],
    );
    const data = await this.loadTutors(manager, classId, { page, limit });
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

  private async lockTutorLink(
    manager: EntityManager,
    userId: string,
    classId: string,
    classMentorId: string,
  ): Promise<ClassMentor> {
    await this.classAccess.requireOwner(userId, classId, manager);
    await manager.query('SELECT id FROM classes WHERE id = $1 FOR UPDATE', [
      classId,
    ]);
    const link = await manager.findOne(ClassMentor, {
      where: { id: classMentorId, class_id: classId },
    });
    if (!link) throw new NotFoundException('Class mentor not found');
    return link;
  }

  private async loadTutors(
    manager: EntityManager,
    classId: string,
    scope: { linkId: string } | { page: number; limit: number },
  ): Promise<ClassTutorResponseDto[]> {
    const byLink = 'linkId' in scope;
    const rows = await manager.query(
      `SELECT link.id, link.class_id, link.mentor_id, mentor.user_id,
              tutor_user.name, tutor_user.email, avatar.object_key AS avatar_object_key,
              link.role, link.permissions, link.created_at
       FROM class_mentors link
       INNER JOIN mentors mentor
         ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
       INNER JOIN users tutor_user
         ON tutor_user.id = mentor.user_id AND tutor_user.deleted_at IS NULL
       LEFT JOIN user_profiles profile
         ON profile.user_id = tutor_user.id AND profile.deleted_at IS NULL
       LEFT JOIN file_assets avatar
         ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
       WHERE link.class_id = $1 AND link.deleted_at IS NULL
         AND ($2::uuid IS NULL OR link.id = $2)
       ORDER BY link.created_at, link.id
       LIMIT $3 OFFSET $4`,
      byLink
        ? [classId, scope.linkId, 1, 0]
        : [classId, null, scope.limit, (scope.page - 1) * scope.limit],
    );
    return rows.map((row) => ({
      id: row.id,
      class_id: row.class_id,
      mentor_id: row.mentor_id,
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      avatar_url: assetUrl(row.avatar_object_key),
      role: row.role,
      permissions: row.permissions,
      created_at: row.created_at,
    }));
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
      category: cls.category,
      level: cls.level,
      duration: cls.duration,
      prerequisites: cls.prerequisites,
      learning_outcomes: cls.learning_outcomes ?? [],
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

  // Locks the class against a concurrent type change and requires a live
  // bootcamp, the only class type with meetings.
  private async lockBootcamp(
    manager: EntityManager,
    classId: string,
  ): Promise<void> {
    const [cls] = await manager.query(
      `SELECT type FROM classes WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
      [classId],
    );
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.type !== ClassType.LIVE_BOOTCAMP) {
      throw new BadRequestException(
        'Meetings are only available for live bootcamps',
      );
    }
  }

  private async assertClassTutor(
    manager: EntityManager,
    classId: string,
    mentorId: string,
  ): Promise<void> {
    const [tutor] = await manager.query(
      `SELECT 1 FROM class_mentors link
       INNER JOIN mentors mentor
         ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL AND mentor.status = 'active'
       WHERE link.class_id = $1 AND link.mentor_id = $2 AND link.deleted_at IS NULL`,
      [classId, mentorId],
    );
    if (!tutor) {
      throw new BadRequestException(
        'mentor_id must be an active tutor of this class',
      );
    }
  }

  private async findMeetingResponse(
    manager: EntityManager,
    classId: string,
    meetingId: string,
  ): Promise<MeetingResponseDto> {
    const [meeting] = await manager.query(
      `${MEETING_RESPONSE_SQL} AND meeting.id = $2`,
      [classId, meetingId],
    );
    return meeting;
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
