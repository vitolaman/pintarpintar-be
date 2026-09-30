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
import { Meeting } from './entities/meeting.entity';
import { ClassMentor } from './entities/class-mentor.entity';
import { Enrollment } from './entities/enrollment.entity';

import { CreateClassDto } from './dto/create-class.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { ClassAccessService } from './class-access.service';
import { ClassListQueryDto } from './dto/class-list-query.dto';
import { ClassResponseDto, MentorResponseDto } from './dto/class-response.dto';
import { UpdateClassMentorDto } from './dto/update-class-mentor.dto';
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
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(ClassMentor)
    private readonly classMentorRepo: Repository<ClassMentor>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
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

  async createMeeting(userId: string, classId: string, dto: CreateMeetingDto) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'tambah');
    const meeting = await this.meetingRepo.save(
      this.meetingRepo.create({
        class_id: classId,
        title: dto.title,
        content: dto.content,
        date: dto.date,
        time: dto.time,
        liveUrl: dto.liveUrl,
        created_by: userId,
      }),
    );
    return { data: meeting, responseMessage: 'Create meeting success' };
  }

  async updateMeeting(
    userId: string,
    classId: string,
    meetingId: string,
    dto: UpdateMeetingDto,
  ) {
    await this.classAccess.requireAction(userId, classId, 'meeting', 'edit');
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId, class_id: classId },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    Object.assign(
      meeting,
      pickDefined(dto, ['title', 'content', 'date', 'time', 'liveUrl']),
    );
    meeting.updated_by = userId;
    const saved = await this.meetingRepo.save(meeting);
    return { data: saved, responseMessage: 'Update meeting success' };
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
      order: { date: 'ASC', time: 'ASC', id: 'ASC' },
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
  ): Promise<MentorResponseDto[]> {
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
