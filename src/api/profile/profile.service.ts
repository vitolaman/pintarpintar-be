import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CertificateStatus } from '../../class/entities/certificate.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileAsset } from './entities/file-asset.entity';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { UserAccess } from './entities/user-access.entity';
import { User } from '../user/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Mentor } from '../mentor/entities/mentor.entity';
import { MentorProfile } from '../mentor/entities/mentor-profile.entity';
import { assetUrl } from '../../common/storage/asset-url';
import { splitSkills } from '../../common/util/skill-list';
import {
  LearningItemResponseDto,
  LearningStatisticsResponseDto,
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
    @InjectRepository(UserAccess)
    private readonly userAccess: Repository<UserAccess>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

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
        user.name = this.requireText(input.name, 'name');
        await manager.save(User, user);
      }

      let profile = await manager.findOneBy(Profile, { userId });

      if (!profile) {
        profile = manager.create(Profile, { userId });
      }

      if (input.avatar_asset_id !== undefined) {
        if (input.avatar_asset_id !== null) {
          const asset = await manager.findOneBy(FileAsset, {
            id: input.avatar_asset_id,
          });

          if (!asset || asset.status !== 'active') {
            throw new BadRequestException('Avatar asset is not available');
          }

          if (asset.uploadedByUserId && asset.uploadedByUserId !== userId) {
            throw new BadRequestException(
              'Avatar asset does not belong to user',
            );
          }
        }

        profile.avatarAssetId = input.avatar_asset_id;
      }

      if (input.phone !== undefined) {
        profile.phone = this.requireText(input.phone, 'phone');
      }

      if (input.headline !== undefined) {
        profile.headline = this.requireText(input.headline, 'headline');
      }

      if (input.bio !== undefined) {
        profile.bio = this.requireText(input.bio, 'bio');
      }

      await manager.save(Profile, profile);
    });

    return this.findCurrent(userId).then((response) => ({
      ...response,
      responseMessage: 'Update profile success',
    }));
  }

  async findLearning(userId: string) {
    const rows = await this.userAccess
      .createQueryBuilder('access')
      .innerJoin(Product, 'product', 'product.id = access.product_id')
      .leftJoin(
        StudentProgress,
        'progress',
        'progress.access_id = access.id AND progress.deleted_at IS NULL',
      )
      .leftJoin(
        FileAsset,
        'cover',
        'cover.id = product.cover_asset_id AND cover.deleted_at IS NULL',
      )
      .select([
        'access.id AS access_id',
        'access.expires_at AS expires_at',
        'access.granted_at AS granted_at',
        'product.id AS product_id',
        'product.title AS title',
        'product.product_type AS product_type',
        'product.level AS level',
        'product.cover_asset_id AS cover_asset_id',
        'cover.object_key AS cover_object_key',
        'COALESCE(progress.completion_percentage, 0) AS completion_percentage',
        'COALESCE(progress.total_time_spent, 0) AS total_time_spent',
        'progress.last_accessed_at AS last_accessed_at',
      ])
      .where('access.user_id = :userId', { userId })
      .andWhere('access.deleted_at IS NULL')
      .andWhere('product.deleted_at IS NULL')
      .andWhere('(access.expires_at IS NULL OR access.expires_at > now())')
      .orderBy('progress.last_accessed_at', 'DESC', 'NULLS LAST')
      .addOrderBy('access.granted_at', 'DESC')
      .getRawMany<LearningRow>();

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
              class.id AS class_id, class.title AS class_title,
              merchant.store_name AS issuer_name, lead_mentor.name AS mentor_name
       FROM certificates certificate
       INNER JOIN classes class ON class.id = certificate.class_id
       LEFT JOIN merchants merchant ON merchant.id = class.merchant_id
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
      data: rows.map((row) => this.toCertificationItem(row)),
      responseMessage: 'Get certifications success',
    };
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

  private toCertificationItem(
    row: CertificationRow,
  ): CertificationItemResponseDto {
    return {
      id: row.id,
      certificate_number: row.certificate_number,
      issued_on: row.issued_on,
      class_id: row.class_id,
      class_title: row.class_title,
      issuer_name: row.issuer_name,
      file_url: row.file_url,
      mentor_name: row.mentor_name,
      // No grading or skills source exists for certificates yet.
      skills: [],
      grade: null,
    };
  }

  private requireText(value: string, fieldName: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} must not be empty`);
    }

    return normalized;
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
  class_id: string;
  class_title: string;
  issuer_name: string | null;
  mentor_name: string | null;
}
