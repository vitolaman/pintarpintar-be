import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { joinSkills, splitSkills } from '../../common/util/skill-list';
import { AuthService } from '../auth/auth.service';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  MentorAssignmentsResponseDto,
  MentorDocumentResponseDto,
  MentorResponseDto,
  PublicMentorResponseDto,
} from './dto/mentor-response.dto';
import { MentorRegistrationDto } from './dto/mentor-registration.dto';
import { MentorSignUpInput } from './dto/mentor-sign-up.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import {
  MENTOR_DOCUMENT_PROVIDER,
  MentorDocumentStorageService,
  StoredMentorDocument,
} from './mentor-document-storage.service';
import { Mentor } from './entities/mentor.entity';
import { MentorProfile } from './entities/mentor-profile.entity';

type MentorFiles = {
  cv?: Express.Multer.File[];
  skill_certificate?: Express.Multer.File[];
};

const EXPERTISE_MAX_LENGTH = 160;

@Injectable()
export class MentorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Mentor)
    private readonly mentors: Repository<Mentor>,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly documentStorage: MentorDocumentStorageService,
  ) {}

  async signUp(input: MentorSignUpInput, files: MentorFiles) {
    const documents = await this.documentStorage.storeRequiredDocuments(files);
    try {
      let userId = '';
      await this.dataSource.transaction(async (manager) => {
        const user = await this.userService.createWithManager(manager, input, {
          isMentor: true,
        });
        userId = user.id;
        await this.createMentor(manager, user, input, documents);
      });
      return this.authService.createTokenResponse('Account Created!', userId);
    } catch (error) {
      await this.documentStorage.remove([documents.cv, documents.certificate]);
      throw error;
    }
  }

  async register(
    userId: string,
    input: MentorRegistrationDto,
    files: MentorFiles,
  ) {
    const documents = await this.documentStorage.storeRequiredDocuments(files);
    try {
      await this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('User not found');
        await this.createMentor(manager, user, input, documents);
      });
    } catch (error) {
      await this.documentStorage.remove([documents.cv, documents.certificate]);
      throw error;
    }

    return this.findProfile(userId).then((response) => ({
      ...response,
      responseMessage: 'Register mentor success',
    }));
  }

  async findProfile(userId: string) {
    return {
      data: await this.findMentorResponse(userId),
      responseMessage: 'Get mentor profile success',
    };
  }

  async updateMyMentor(userId: string, input: UpdateMentorDto) {
    await this.dataSource.transaction(async (manager) => {
      const mentor = await this.findOwnedMentor(manager, userId, true);
      const mentorProfile = await manager.findOneBy(MentorProfile, {
        mentorId: mentor.id,
      });
      if (!mentorProfile)
        throw new NotFoundException('Mentor profile not found');

      let profile = await manager.findOneBy(Profile, { userId });
      if (!profile) profile = manager.create(Profile, { userId });
      if (input.phone !== undefined) profile.phone = input.phone;
      if (input.headline !== undefined)
        profile.headline = input.headline ?? null;
      if (input.bio !== undefined) profile.bio = input.bio ?? null;
      if (input.expertise_list !== undefined) {
        mentorProfile.expertise = this.expertiseFromList(input.expertise_list);
      } else if (input.expertise !== undefined) {
        mentorProfile.expertise = input.expertise;
      }
      if (input.experience_years !== undefined) {
        mentorProfile.experienceYears = input.experience_years;
      }
      if (input.education !== undefined)
        mentorProfile.education = input.education;
      if (input.portfolio_url !== undefined) {
        mentorProfile.portfolioUrl = input.portfolio_url ?? null;
      }
      if (input.linkedin_url !== undefined) {
        mentorProfile.linkedinUrl = input.linkedin_url;
      }
      await manager.save(Profile, profile);
      await manager.save(MentorProfile, mentorProfile);
    });

    return this.findProfile(userId).then((response) => ({
      ...response,
      responseMessage: 'Update mentor profile success',
    }));
  }

  async updateDocuments(userId: string, files: MentorFiles) {
    const documents =
      await this.documentStorage.storeReplacementDocuments(files);
    const stored = [documents.cv, documents.certificate].filter(
      (document): document is StoredMentorDocument => !!document,
    );
    let replaced: FileAsset[] = [];
    try {
      replaced = await this.dataSource.transaction(async (manager) => {
        const mentor = await this.findOwnedMentor(manager, userId, true);
        const mentorProfile = await manager.findOneBy(MentorProfile, {
          mentorId: mentor.id,
        });
        if (!mentorProfile) {
          throw new NotFoundException('Mentor profile not found');
        }

        await this.saveDocuments(manager, userId, stored);
        const previousIds: string[] = [];
        if (documents.cv) {
          previousIds.push(mentorProfile.cvAssetId);
          mentorProfile.cvAssetId = documents.cv.assetId;
        }
        if (documents.certificate) {
          previousIds.push(mentorProfile.skillCertificateAssetId);
          mentorProfile.skillCertificateAssetId = documents.certificate.assetId;
        }
        await manager.save(MentorProfile, mentorProfile);

        const previous = await manager.findByIds(FileAsset, previousIds);
        if (previous.length > 0) {
          await manager.update(FileAsset, previousIds, { status: 'deleted' });
          await manager.softDelete(FileAsset, previousIds);
        }
        return previous;
      });
    } catch (error) {
      await this.documentStorage.remove(stored);
      throw error;
    }

    // Old objects are removed only after the profile points at the new ones.
    await this.documentStorage.remove(
      replaced.filter(
        (asset) => asset.storageProvider === MENTOR_DOCUMENT_PROVIDER,
      ),
    );
    return this.findDocuments(userId).then((response) => ({
      ...response,
      responseMessage: 'Update mentor documents success',
    }));
  }

  async findDocuments(userId: string) {
    const rows: Array<{
      kind: 'cv' | 'skill_certificate';
      asset_id: string;
      filename: string;
      mime_type: string;
      size_bytes: string;
      uploaded_at: Date;
      storage_provider: string;
      object_key: string;
    }> = await this.dataSource.query(
      `SELECT document.kind, asset.id AS asset_id,
              asset.original_filename AS filename, asset.mime_type,
              asset.size_bytes, asset.created_at AS uploaded_at,
              asset.storage_provider, asset.object_key
       FROM mentors mentor
       INNER JOIN mentor_profiles profile
         ON profile.mentor_id = mentor.id AND profile.deleted_at IS NULL
       CROSS JOIN LATERAL (VALUES
         ('cv', profile.cv_asset_id),
         ('skill_certificate', profile.skill_certificate_asset_id)
       ) AS document(kind, asset_id)
       INNER JOIN file_assets asset ON asset.id = document.asset_id
       WHERE mentor.user_id = $1 AND mentor.deleted_at IS NULL
       ORDER BY document.kind`,
      [userId],
    );
    if (rows.length === 0) throw new NotFoundException('Mentor not found');

    const data: MentorDocumentResponseDto[] = await Promise.all(
      rows.map(async (row) => ({
        kind: row.kind,
        asset_id: row.asset_id,
        filename: row.filename,
        mime_type: row.mime_type,
        size_bytes: Number(row.size_bytes),
        uploaded_at: row.uploaded_at,
        download_url:
          row.storage_provider === MENTOR_DOCUMENT_PROVIDER
            ? await this.documentStorage.signedDownloadUrl(
                row.object_key,
                row.filename,
              )
            : null,
      })),
    );
    return { data, responseMessage: 'Get mentor documents success' };
  }

  async findAssignments(userId: string) {
    const mentor = await this.mentors.findOneBy({ userId });
    if (!mentor) throw new NotFoundException('Mentor not found');

    const [merchantAssignments, productAssignments, classAssignments] =
      await Promise.all([
        this.dataSource.query(
          `SELECT relation.merchant_id, merchant.store_name, relation.status, relation.joined_at
         FROM merchant_mentors relation
         INNER JOIN merchants merchant ON merchant.id = relation.merchant_id AND merchant.deleted_at IS NULL
         WHERE relation.mentor_user_id = $1 AND relation.status = 'active' AND relation.deleted_at IS NULL
         ORDER BY relation.joined_at DESC NULLS LAST`,
          [userId],
        ),
        this.dataSource.query(
          `SELECT assignment.product_id, product.title, product.product_type, assignment.role, assignment.sort_order
         FROM product_mentors assignment
         INNER JOIN products product ON product.id = assignment.product_id AND product.deleted_at IS NULL
         WHERE assignment.mentor_user_id = $1 AND assignment.deleted_at IS NULL
         ORDER BY assignment.sort_order ASC, product.created_at DESC`,
          [userId],
        ),
        this.dataSource.query(
          `SELECT link.id, link.class_id, class.title, class.type, class.status,
                class.merchant_id, merchant.store_name, link.role, link.permissions,
                link.created_at AS assigned_at
         FROM class_mentors link
         INNER JOIN classes class ON class.id = link.class_id AND class.deleted_at IS NULL
         INNER JOIN merchants merchant ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
         WHERE link.mentor_id = $1 AND link.deleted_at IS NULL
         ORDER BY link.created_at DESC, link.id`,
          [mentor.id],
        ),
      ]);
    const data: MentorAssignmentsResponseDto = {
      merchant_assignments: merchantAssignments,
      product_assignments: productAssignments,
      class_assignments: classAssignments,
    };
    return { data, responseMessage: 'Get mentor assignments success' };
  }

  async findPublicMentor(id: string) {
    const row = await this.mentors
      .createQueryBuilder('mentor')
      .innerJoin(
        User,
        'user',
        'user.id = mentor.user_id AND user.deleted_at IS NULL',
      )
      .innerJoin(
        MentorProfile,
        'mentor_profile',
        'mentor_profile.mentor_id = mentor.id AND mentor_profile.deleted_at IS NULL',
      )
      .leftJoin(
        Profile,
        'profile',
        'profile.user_id = user.id AND profile.deleted_at IS NULL',
      )
      .select([
        'mentor.id AS id',
        'mentor.status AS status',
        'user.name AS name',
        'profile.headline AS headline',
        'profile.bio AS bio',
        'mentor_profile.expertise AS expertise',
        'mentor_profile.experience_years AS experience_years',
        'mentor_profile.education AS education',
        'mentor_profile.portfolio_url AS portfolio_url',
        'mentor_profile.linkedin_url AS linkedin_url',
      ])
      .where('mentor.id = :id', { id })
      .andWhere('mentor.deleted_at IS NULL')
      .andWhere('mentor.status = :status', { status: 'active' })
      .getRawOne<PublicMentorResponseDto & { experience_years: string }>();
    if (!row) throw new NotFoundException('Mentor not found');
    return {
      data: {
        ...row,
        experience_years: Number(row.experience_years),
        expertise_list: splitSkills(row.expertise),
      },
      responseMessage: 'Get mentor success',
    };
  }

  private async createMentor(
    manager: EntityManager,
    user: User,
    input: MentorRegistrationDto,
    documents: { cv: StoredMentorDocument; certificate: StoredMentorDocument },
  ): Promise<void> {
    const existing = await manager.findOne(Mentor, {
      where: { userId: user.id },
      withDeleted: true,
    });
    if (existing) throw new ConflictException('User is already a mentor');

    const mentor = manager.create(Mentor, {
      userId: user.id,
      status: 'active',
    });
    await manager.save(Mentor, mentor);
    await this.saveDocuments(manager, user.id, [
      documents.cv,
      documents.certificate,
    ]);
    await manager.save(
      MentorProfile,
      manager.create(MentorProfile, {
        mentorId: mentor.id,
        expertise: input.expertise,
        experienceYears: input.experience_years,
        education: input.education,
        portfolioUrl: input.portfolio_url ?? null,
        linkedinUrl: input.linkedin_url,
        cvAssetId: documents.cv.assetId,
        skillCertificateAssetId: documents.certificate.assetId,
      }),
    );

    let profile = await manager.findOneBy(Profile, { userId: user.id });
    if (!profile) profile = manager.create(Profile, { userId: user.id });
    profile.phone = input.phone;
    profile.headline = input.headline ?? null;
    profile.bio = input.bio ?? null;
    await manager.save(Profile, profile);

    user.isMentor = true;
    await manager.save(User, user);
  }

  private async saveDocuments(
    manager: EntityManager,
    userId: string,
    documents: StoredMentorDocument[],
  ): Promise<void> {
    await manager.save(
      FileAsset,
      documents.map((document) =>
        manager.create(FileAsset, {
          id: document.assetId,
          uploadedByUserId: userId,
          storageProvider: MENTOR_DOCUMENT_PROVIDER,
          objectKey: document.objectKey,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          sizeBytes: String(document.sizeBytes),
          checksumSha256: document.checksumSha256,
          visibility: 'private',
          status: 'active',
        }),
      ),
    );
  }

  private async findOwnedMentor(
    manager: EntityManager,
    userId: string,
    lock = false,
  ): Promise<Mentor> {
    const mentor = await manager.findOne(Mentor, {
      where: { userId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!mentor) throw new NotFoundException('Mentor not found');
    return mentor;
  }

  private async findMentorResponse(userId: string): Promise<MentorResponseDto> {
    const row = await this.mentors
      .createQueryBuilder('mentor')
      .innerJoin(
        User,
        'user',
        'user.id = mentor.user_id AND user.deleted_at IS NULL',
      )
      .innerJoin(
        MentorProfile,
        'mentor_profile',
        'mentor_profile.mentor_id = mentor.id AND mentor_profile.deleted_at IS NULL',
      )
      .innerJoin(
        Profile,
        'profile',
        'profile.user_id = user.id AND profile.deleted_at IS NULL',
      )
      .select([
        'mentor.id AS id',
        'mentor.user_id AS user_id',
        'mentor.status AS status',
        'user.name AS name',
        'user.email AS email',
        'profile.phone AS phone',
        'profile.headline AS headline',
        'profile.bio AS bio',
        'mentor_profile.expertise AS expertise',
        'mentor_profile.experience_years AS experience_years',
        'mentor_profile.education AS education',
        'mentor_profile.portfolio_url AS portfolio_url',
        'mentor_profile.linkedin_url AS linkedin_url',
        'mentor_profile.cv_asset_id AS cv_asset_id',
        'mentor_profile.skill_certificate_asset_id AS skill_certificate_asset_id',
      ])
      .where('mentor.user_id = :userId', { userId })
      .andWhere('mentor.deleted_at IS NULL')
      .getRawOne<MentorResponseDto & { experience_years: string }>();
    if (!row) throw new NotFoundException('Mentor not found');
    return {
      ...row,
      experience_years: Number(row.experience_years),
      expertise_list: splitSkills(row.expertise),
    };
  }

  private expertiseFromList(skills: string[]): string {
    const expertise = joinSkills(skills);
    if (!expertise) {
      throw new BadRequestException('expertise_list must contain a skill');
    }
    if (expertise.length > EXPERTISE_MAX_LENGTH) {
      throw new BadRequestException(
        `expertise_list must fit in ${EXPERTISE_MAX_LENGTH} characters`,
      );
    }
    return expertise;
  }
}
