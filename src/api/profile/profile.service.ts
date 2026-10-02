import { ConfigService } from '@nestjs/config';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CertificateStatus } from '../../class/entities/certificate.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileAsset } from './entities/file-asset.entity';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { User } from '../user/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Mentor } from '../mentor/entities/mentor.entity';
import { MentorProfile } from '../mentor/entities/mentor-profile.entity';
import {
  ObjectStorage,
  createObjectStorage,
} from '../../common/storage/object-storage';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';
import { assetUrl } from '../../common/storage/asset-url';
import { progressSql } from '../../class/learning-progress.service';
import { MentorWorkspaceService } from '../mentor/mentor-workspace.service';
import { splitSkills } from '../../common/util/skill-list';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { OnboardingRole } from './onboarding.constants';
import {
  LearningItemResponseDto,
  LearningStatisticsResponseDto,
  PublicProfileResponseDto,
  ProfileResponseDto,
  CertificationItemResponseDto,
} from './dto/profile-response.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(FileAsset)
    private readonly fileAssets: Repository<FileAsset>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Profile)
    private readonly profiles: Repository<Profile>,
    @InjectRepository(StudentProgress)
    private readonly studentProgress: Repository<StudentProgress>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mentorWorkspace: MentorWorkspaceService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  private readonly storage: ObjectStorage;

  async findCurrent(userId: string) {
    const profile = await this.findProfileResponse(userId);

    return {
      data: profile,
      responseMessage: 'Get profile success',
    };
  }

  async updateCurrent(userId: string, input: UpdateProfileDto) {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (input.name !== undefined) {
        user.name = input.name;
        await manager.save(User, user);
      }

      let profile = await manager.findOneBy(Profile, { userId });

      if (!profile) {
        profile = manager.create(Profile, { userId });
      }

      if (input.avatar_asset_id !== undefined) {
        if (input.avatar_asset_id !== null) {
          await assertOwnedAsset(
            manager,
            userId,
            input.avatar_asset_id,
            'user_avatar',
          );
        }

        profile.avatarAssetId = input.avatar_asset_id;
      }

      if (input.phone !== undefined) {
        profile.phone = input.phone;
      }

      if (input.headline !== undefined) {
        profile.headline = input.headline;
      }

      if (input.bio !== undefined) {
        profile.bio = input.bio;
      }

      await manager.save(Profile, profile);
    });

    return this.findCurrent(userId).then((response) => ({
      ...response,
      responseMessage: 'Update profile success',
    }));
  }

  // Saving again replaces the answers. The chosen role is informational only:
  // it never sets is_mentor or is_merchant.
  async updateOnboarding(userId: string, input: UpdateOnboardingDto) {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) throw new NotFoundException('User not found');

      let profile = await manager.findOneBy(Profile, { userId });
      if (!profile) profile = manager.create(Profile, { userId });
      profile.onboardingRole = input.role;
      profile.customRole = input.role === 'custom' ? input.custom_role : null;
      profile.skills = input.skills;
      profile.onboardingCompletedAt = new Date();
      await manager.save(Profile, profile);
    });

    const { data } = await this.findCurrent(userId);
    return {
      data: data.onboarding,
      responseMessage: 'Update onboarding success',
    };
  }

  // Everything the user owns: digital products with unexpired access, and
  // classes and bootcamps with an active enrollment. The frontend uses this
  // list for ownership checks and Portal Saya.
  async findLearning(userId: string) {
    const rows: LearningRow[] = await this.dataSource.query(
      `SELECT * FROM (
         SELECT access.id AS access_id, access.expires_at, access.granted_at AS acquired_at,
                product.id AS product_id, product.title, product.product_type, product.level,
                product.cover_asset_id, cover.object_key AS cover_object_key,
                COALESCE(progress.completion_percentage, 0) AS completion_percentage,
                COALESCE(progress.total_time_spent, 0) AS total_time_spent,
                progress.last_accessed_at
         FROM user_access access
         INNER JOIN products product ON product.id = access.product_id AND product.deleted_at IS NULL
         LEFT JOIN student_progress progress
           ON progress.access_id = access.id AND progress.deleted_at IS NULL
         LEFT JOIN file_assets cover ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
         WHERE access.user_id = $1 AND access.deleted_at IS NULL
           AND (access.expires_at IS NULL OR access.expires_at > now())

         UNION ALL

         SELECT enrollment.id, NULL::timestamp, enrollment.created_at,
                class.id, class.title,
                CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END,
                class.level, class.cover_asset_id, cover.object_key,
                ${progressSql('$1::uuid', 'class.id')},
                0,
                (SELECT max(completion.completed_at) FROM video_completions completion
                 WHERE completion.user_id = $1 AND completion.class_id = class.id
                   AND completion.deleted_at IS NULL)
         FROM enrollments enrollment
         INNER JOIN classes class ON class.id = enrollment.class_id AND class.deleted_at IS NULL
         LEFT JOIN file_assets cover ON cover.id = class.cover_asset_id AND cover.deleted_at IS NULL
         WHERE enrollment.user_id = $1 AND enrollment.deleted_at IS NULL
       ) learning
       ORDER BY last_accessed_at DESC NULLS LAST, acquired_at DESC, product_id`,
      [userId],
    );

    return {
      data: rows.map((row) => this.toLearningItem(row)),
      responseMessage: 'Get learning success',
    };
  }

  async findStatistics(userId: string) {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT count(DISTINCT enrollment.class_id) FROM enrollments enrollment
            INNER JOIN classes class ON class.id = enrollment.class_id AND class.deleted_at IS NULL
            WHERE enrollment.user_id = $1 AND enrollment.deleted_at IS NULL
              AND class.type = 'live-bootcamp')::integer AS bootcamp_count,
         (SELECT count(DISTINCT enrollment.class_id) FROM enrollments enrollment
            INNER JOIN classes class ON class.id = enrollment.class_id AND class.deleted_at IS NULL
            WHERE enrollment.user_id = $1 AND enrollment.deleted_at IS NULL
              AND class.type <> 'live-bootcamp')::integer AS video_class_count,
         (SELECT count(DISTINCT access.product_id) FROM user_access access
            INNER JOIN products product ON product.id = access.product_id
            WHERE access.user_id = $1 AND access.deleted_at IS NULL
              AND (access.expires_at IS NULL OR access.expires_at > now()))::integer AS digital_product_count,
         (SELECT count(*) FROM certificates certificate
            WHERE certificate.user_id = $1 AND certificate.status = $2
              AND certificate.deleted_at IS NULL)::integer AS certificate_count`,
      [userId, CertificateStatus.ISSUED],
    );
    const data: LearningStatisticsResponseDto = {
      bootcamp_count: row.bootcamp_count,
      video_class_count: row.video_class_count,
      digital_product_count: row.digital_product_count,
      certificate_count: row.certificate_count,
    };
    return { data, responseMessage: 'Get learning statistics success' };
  }

  async findCertifications(userId: string) {
    const rows: CertificationRow[] = await this.dataSource.query(
      `SELECT certificate.id, certificate."certNo" AS certificate_number,
              certificate."issueDate"::text AS issued_on, certificate."fileUrl" AS file_url,
              file.object_key AS file_object_key, file.original_filename AS file_name,
              graded.final_score,
              class.id AS class_id, class.title AS class_title, class.category AS class_category,
              merchant.store_name AS issuer_name, lead_mentor.name AS mentor_name
       FROM certificates certificate
       INNER JOIN classes class ON class.id = certificate.class_id
       LEFT JOIN merchants merchant ON merchant.id = class.merchant_id
       LEFT JOIN file_assets file ON file.id = certificate.asset_id AND file.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT round(avg(submission.total_score), 1) AS final_score
         FROM submissions submission
         INNER JOIN assignments assignment
           ON assignment.id = submission.assignment_id AND assignment.deleted_at IS NULL
         WHERE assignment.class_id = class.id AND submission.user_id = certificate.user_id
           AND submission.deleted_at IS NULL AND submission.total_score IS NOT NULL
       ) graded ON true
       LEFT JOIN LATERAL (
         SELECT mentor_user.name
         FROM class_mentors link
         INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
         INNER JOIN users mentor_user ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
         WHERE link.class_id = class.id AND link.deleted_at IS NULL
         ORDER BY link.created_at, link.id
         LIMIT 1
       ) lead_mentor ON true
       WHERE certificate.user_id = $1 AND certificate.status = $2
         AND certificate.deleted_at IS NULL
       ORDER BY certificate."issueDate" DESC NULLS LAST, certificate.created_at DESC, certificate.id DESC`,
      [userId, CertificateStatus.ISSUED],
    );

    return {
      data: await Promise.all(rows.map((row) => this.toCertificationItem(row))),
      responseMessage: 'Get certifications success',
    };
  }

  // Anyone may view a profile; only public fields leave this method.
  async findPublicProfile(userId: string) {
    const identity = await this.findProfileResponse(userId);
    const [merchant] = identity.merchant_id
      ? await this.dataSource.query(
          `SELECT merchant.id, merchant.store_name, profile.slug
           FROM merchants merchant
           LEFT JOIN merchant_profiles profile
             ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
           WHERE merchant.id = $1`,
          [identity.merchant_id],
        )
      : [];
    const [{ data: learningStatistics }, { data: certificates }] =
      await Promise.all([
        this.findStatistics(userId),
        this.findCertifications(userId),
      ]);
    const teachingClasses = identity.mentor_id
      ? (await this.mentorWorkspace.findTeachingClasses(userId)).data
      : [];
    const [teaching] = identity.mentor_id
      ? await this.dataSource.query(
          `SELECT count(DISTINCT enrollment.user_id)::integer AS students_count
           FROM class_mentors link
           INNER JOIN classes class ON class.id = link.class_id AND class.deleted_at IS NULL
           INNER JOIN enrollments enrollment
             ON enrollment.class_id = class.id AND enrollment.deleted_at IS NULL
           WHERE link.mentor_id = $1 AND link.deleted_at IS NULL`,
          [identity.mentor_id],
        )
      : [];

    const data: PublicProfileResponseDto = {
      id: identity.id,
      name: identity.name,
      avatar_url: identity.avatar_url,
      headline: identity.headline,
      bio: identity.bio,
      member_since: identity.member_since,
      is_mentor: identity.is_mentor,
      is_merchant: identity.is_merchant,
      merchant: merchant
        ? {
            id: merchant.id,
            slug: merchant.slug,
            store_name: merchant.store_name,
          }
        : null,
      mentor: identity.mentor_id
        ? { id: identity.mentor_id, expertise_list: identity.expertise_list }
        : null,
      learning_statistics: learningStatistics,
      teaching_statistics: identity.mentor_id
        ? {
            classes_count: teachingClasses.length,
            active_classes_count: teachingClasses.filter(
              (item) => item.status === 'active',
            ).length,
            students_count: teaching.students_count,
          }
        : null,
      teaching_classes: teachingClasses,
      certificates: certificates.map((certificate) => ({
        id: certificate.id,
        class_id: certificate.class_id,
        class_title: certificate.class_title,
        certificate_number: certificate.certificate_number,
        issued_on: certificate.issued_on,
        issuer_name: certificate.issuer_name,
        mentor_name: certificate.mentor_name,
      })),
    };
    return { data, responseMessage: 'Get public profile success' };
  }

  private async findProfileResponse(
    userId: string,
  ): Promise<ProfileResponseDto> {
    const row = await this.users
      .createQueryBuilder('user')
      .leftJoin(
        Profile,
        'profile',
        'profile.user_id = user.id AND profile.deleted_at IS NULL',
      )
      .leftJoin(
        FileAsset,
        'avatar',
        'avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL',
      )
      .leftJoin(
        Mentor,
        'mentor',
        'mentor.user_id = user.id AND mentor.deleted_at IS NULL',
      )
      .leftJoin(
        MentorProfile,
        'mentor_profile',
        'mentor_profile.mentor_id = mentor.id AND mentor_profile.deleted_at IS NULL',
      )
      .leftJoin(
        Merchant,
        'merchant',
        'merchant.user_id = user.id AND merchant.deleted_at IS NULL',
      )
      .select([
        'user.id AS id',
        'user.name AS name',
        'user.email AS email',
        'user.is_mentor AS is_mentor',
        'user.is_merchant AS is_merchant',
        'profile.avatar_asset_id AS avatar_asset_id',
        'avatar.object_key AS avatar_object_key',
        'profile.phone AS phone',
        'profile.headline AS headline',
        'profile.bio AS bio',
        'profile.onboarding_role AS onboarding_role',
        'profile.custom_role AS custom_role',
        'profile.skills AS skills',
        'profile.onboarding_completed_at AS onboarding_completed_at',
        'mentor.id AS mentor_id',
        'mentor_profile.expertise AS mentor_expertise',
        'merchant.id AS merchant_id',
        'user.created_at AS member_since',
      ])
      .where('user.id = :userId::uuid', { userId })
      .andWhere('user.deleted_at IS NULL')
      .getRawOne<ProfileRow>();

    if (!row) {
      throw new NotFoundException('User not found');
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      is_mentor: row.is_mentor,
      is_merchant: row.is_merchant,
      avatar_asset_id: row.avatar_asset_id,
      avatar_object_key: row.avatar_object_key,
      avatar_url: assetUrl(row.avatar_object_key),
      phone: row.phone,
      headline: row.headline,
      bio: row.bio,
      mentor_id: row.mentor_id,
      merchant_id: row.merchant_id,
      member_since: row.member_since,
      expertise_list: splitSkills(row.mentor_expertise),
      onboarding: {
        role: row.onboarding_role,
        custom_role: row.custom_role,
        skills: row.skills ?? [],
        completed_at: row.onboarding_completed_at,
      },
    };
  }

  private toLearningItem(row: LearningRow): LearningItemResponseDto {
    const completionPercentage = Number(row.completion_percentage);

    return {
      access_id: row.access_id,
      product_id: row.product_id,
      title: row.title,
      product_type: row.product_type,
      level: row.level,
      cover_asset_id: row.cover_asset_id,
      cover_object_key: row.cover_object_key,
      cover_url: assetUrl(row.cover_object_key),
      completion_percentage: completionPercentage,
      progress_status:
        completionPercentage >= 100
          ? 'completed'
          : completionPercentage > 0
            ? 'in_progress'
            : 'not_started',
      total_time_spent: Number(row.total_time_spent),
      last_accessed_at: row.last_accessed_at,
      expires_at: row.expires_at,
    };
  }

  // Uploaded certificate files are private and served through a short-lived
  // link; older rows keep their stored URL.
  private async toCertificationItem(
    row: CertificationRow,
  ): Promise<CertificationItemResponseDto> {
    const finalScore =
      row.final_score === null || row.final_score === undefined
        ? null
        : Number(row.final_score);
    return {
      id: row.id,
      certificate_number: row.certificate_number,
      issued_on: row.issued_on,
      class_id: row.class_id,
      class_title: row.class_title,
      issuer_name: row.issuer_name,
      file_url: row.file_object_key
        ? await signedDownloadUrl(
            this.storage,
            row.file_object_key,
            row.file_name ?? 'certificate',
          )
        : row.file_url,
      mentor_name: row.mentor_name,
      // The class Bidang is the only per-class skill source.
      skills: row.class_category ? [row.class_category] : [],
      final_score: finalScore,
      grade: finalScore === null ? null : String(finalScore),
    };
  }
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  is_mentor: boolean;
  is_merchant: boolean;
  avatar_asset_id: string | null;
  avatar_object_key: string | null;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  mentor_id: string | null;
  mentor_expertise: string | null;
  merchant_id: string | null;
  member_since: Date;
  onboarding_role: OnboardingRole | null;
  custom_role: string | null;
  skills: string[] | null;
  onboarding_completed_at: Date | null;
}

interface LearningRow {
  access_id: string;
  product_id: string;
  title: string;
  product_type: string;
  level: string | null;
  cover_asset_id: string | null;
  cover_object_key: string | null;
  completion_percentage: string;
  total_time_spent: string;
  last_accessed_at: Date | null;
  expires_at: Date | null;
}

interface CertificationRow {
  id: string;
  certificate_number: string | null;
  issued_on: string | null;
  file_url: string | null;
  file_object_key: string | null;
  file_name: string | null;
  final_score: string | null;
  class_id: string;
  class_title: string;
  class_category: string | null;
  issuer_name: string | null;
  mentor_name: string | null;
}
