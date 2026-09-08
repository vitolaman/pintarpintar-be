import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  MentorAssignmentsResponseDto,
  MentorResponseDto,
  PublicMentorResponseDto,
} from './dto/mentor-response.dto';
import { MentorRegistrationDto } from './dto/mentor-registration.dto';
import { MentorSignUpInput } from './dto/mentor-sign-up.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import {
  MentorDocumentStorageService,
  StoredMentorDocument,
} from './mentor-document-storage.service';
import { Mentor } from './entities/mentor.entity';
import { MentorProfile } from './entities/mentor-profile.entity';

type MentorFiles = {
  cv?: Express.Multer.File[];
  skill_certificate?: Express.Multer.File[];
};

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
      if (!mentorProfile) throw new NotFoundException('Mentor profile not found');

      let profile = await manager.findOneBy(Profile, { userId });
      if (!profile) profile = manager.create(Profile, { userId });
      if (input.phone !== undefined) profile.phone = input.phone;
      if (input.headline !== undefined) profile.headline = input.headline ?? null;
      if (input.bio !== undefined) profile.bio = input.bio ?? null;
      if (input.expertise !== undefined) mentorProfile.expertise = input.expertise;
      if (input.experience_years !== undefined) {
        mentorProfile.experienceYears = input.experience_years;
      }
      if (input.education !== undefined) mentorProfile.education = input.education;
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

  async findAssignments(userId: string) {
    const mentor = await this.mentors.findOneBy({ userId });
    if (!mentor) throw new NotFoundException('Mentor not found');

    const [merchantAssignments, productAssignments] = await Promise.all([
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
    ]);
    const data: MentorAssignmentsResponseDto = {
      merchant_assignments: merchantAssignments,
      product_assignments: productAssignments,
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
      data: { ...row, experience_years: Number(row.experience_years) },
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

    const mentor = manager.create(Mentor, { userId: user.id, status: 'active' });
    await manager.save(Mentor, mentor);
    await this.saveDocuments(manager, user.id, documents);
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
    documents: { cv: StoredMentorDocument; certificate: StoredMentorDocument },
  ): Promise<void> {
    await manager.save(
      FileAsset,
      [documents.cv, documents.certificate].map((document) =>
        manager.create(FileAsset, {
          id: document.assetId,
          uploadedByUserId: userId,
          storageProvider: 'local',
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
      .innerJoin(User, 'user', 'user.id = mentor.user_id AND user.deleted_at IS NULL')
      .innerJoin(MentorProfile, 'mentor_profile', 'mentor_profile.mentor_id = mentor.id AND mentor_profile.deleted_at IS NULL')
      .innerJoin(Profile, 'profile', 'profile.user_id = user.id AND profile.deleted_at IS NULL')
      .select([
        'mentor.id AS id', 'mentor.user_id AS user_id', 'mentor.status AS status',
        'user.name AS name', 'user.email AS email', 'profile.phone AS phone',
        'profile.headline AS headline', 'profile.bio AS bio',
        'mentor_profile.expertise AS expertise', 'mentor_profile.experience_years AS experience_years',
        'mentor_profile.education AS education', 'mentor_profile.portfolio_url AS portfolio_url',
        'mentor_profile.linkedin_url AS linkedin_url', 'mentor_profile.cv_asset_id AS cv_asset_id',
        'mentor_profile.skill_certificate_asset_id AS skill_certificate_asset_id',
      ])
      .where('mentor.user_id = :userId', { userId })
      .andWhere('mentor.deleted_at IS NULL')
      .getRawOne<MentorResponseDto & { experience_years: string }>();
    if (!row) throw new NotFoundException('Mentor not found');
    return { ...row, experience_years: Number(row.experience_years) };
  }
}
