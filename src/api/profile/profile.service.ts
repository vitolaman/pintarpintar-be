import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileAsset } from './entities/file-asset.entity';
import { IssuedCertificate } from './entities/issued-certificate.entity';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { UserAccess } from './entities/user-access.entity';
import { User } from '../user/entities/user.entity';
import {
  LearningItemResponseDto,
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
    @InjectRepository(IssuedCertificate)
    private readonly issuedCertificates: Repository<IssuedCertificate>,
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

  async findCertifications(userId: string) {
    const rows = await this.issuedCertificates
      .createQueryBuilder('certificate')
      .innerJoin(Product, 'product', 'product.id = certificate.product_id')
      .leftJoin(
        FileAsset,
        'asset',
        'asset.id = certificate.certificate_asset_id AND asset.deleted_at IS NULL AND asset.status = :assetStatus',
        { assetStatus: 'active' },
      )
      .select([
        'certificate.id AS id',
        'certificate.product_id AS product_id',
        'certificate.certificate_number AS certificate_number',
        'certificate.issued_at AS issued_at',
        'certificate.certificate_asset_id AS certificate_asset_id',
        'asset.object_key AS certificate_asset_object_key',
        'product.title AS product_title',
      ])
      .where('certificate.user_id = :userId', { userId })
      .andWhere('certificate.deleted_at IS NULL')
      .andWhere('certificate.revoked_at IS NULL')
      .andWhere('product.deleted_at IS NULL')
      .orderBy('certificate.issued_at', 'DESC')
      .getRawMany<CertificationRow>();

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
      ])
      .where('user.id = :userId', { userId })
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
      phone: row.phone,
      headline: row.headline,
      bio: row.bio,
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
      product_id: row.product_id,
      product_title: row.product_title,
      certificate_number: row.certificate_number,
      issued_at: row.issued_at,
      certificate_asset_id: row.certificate_asset_id,
      certificate_asset_object_key: row.certificate_asset_object_key,
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
  product_id: string;
  product_title: string;
  certificate_number: string;
  issued_at: Date;
  certificate_asset_id: string | null;
  certificate_asset_object_key: string | null;
}
