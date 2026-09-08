import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import {
  MerchantResponseDto,
  NotificationPreferencesResponseDto,
} from './dto/merchant-response.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMyMerchantDto } from './dto/update-my-merchant.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { MerchantMember } from './entities/merchant-member.entity';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant } from './entities/merchant.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';

@Injectable()
export class MerchantService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    @InjectRepository(UserNotificationPreferences)
    private readonly notificationPreferences: Repository<UserNotificationPreferences>,
  ) {}

  async register(userId: string, input: RegisterMerchantDto) {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');

      const existing = await manager.findOne(Merchant, {
        where: { userId },
        withDeleted: true,
      });
      if (existing) throw new ConflictException('User already owns a merchant');

      const merchant = manager.create(Merchant, {
        userId,
        storeName: input.store_name,
        storeDescription: input.store_description,
        status: 'active',
      });
      await manager.save(Merchant, merchant);

      await manager.save(
        MerchantProfile,
        manager.create(MerchantProfile, {
          merchantId: merchant.id,
          slug: await this.nextAvailableSlug(manager, input.store_name),
        }),
      );
      await manager.save(
        MerchantMember,
        manager.create(MerchantMember, {
          merchantId: merchant.id,
          userId,
          role: 'owner',
          status: 'active',
          joinedAt: new Date(),
        }),
      );

      const preferences = await manager.findOneBy(UserNotificationPreferences, {
        userId,
      });
      if (!preferences) {
        await manager.save(
          UserNotificationPreferences,
          manager.create(UserNotificationPreferences, { userId }),
        );
      }

      user.isMerchant = true;
      await manager.save(User, user);
    });

    return this.findMyMerchant(userId).then((response) => ({
      ...response,
      responseMessage: 'Register merchant success',
    }));
  }

  async findMyMerchant(userId: string) {
    await this.ensureMerchantProfile(userId);
    return {
      data: await this.findMerchantResponse(userId),
      responseMessage: 'Get my merchant success',
    };
  }

  async updateMyMerchant(userId: string, input: UpdateMyMerchantDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findOwnedMerchant(manager, userId, true);
      let profile = await manager.findOneBy(MerchantProfile, {
        merchantId: merchant.id,
      });
      if (!profile) {
        profile = manager.create(MerchantProfile, {
          merchantId: merchant.id,
          slug: await this.nextAvailableSlug(manager, merchant.storeName),
        });
      }

      if (input.store_name !== undefined) merchant.storeName = input.store_name;
      if (input.store_description !== undefined) {
        merchant.storeDescription = input.store_description;
      }
      if (input.phone !== undefined) {
        await this.savePrivatePhone(manager, userId, input.phone);
      }

      if (input.tagline !== undefined) profile.tagline = input.tagline;
      if (input.category_label !== undefined)
        profile.categoryLabel = input.category_label;
      if (input.city !== undefined) profile.city = input.city;
      if (input.public_email !== undefined)
        profile.publicEmail = input.public_email;
      if (input.public_phone !== undefined)
        profile.publicPhone = input.public_phone;
      if (input.website_url !== undefined)
        profile.websiteUrl = input.website_url;
      if (input.instagram_handle !== undefined) {
        profile.instagramHandle = input.instagram_handle;
      }
      if (input.youtube_url !== undefined)
        profile.youtubeUrl = input.youtube_url;
      if (input.linkedin_url !== undefined)
        profile.linkedinUrl = input.linkedin_url;
      if (input.expertise !== undefined) profile.expertise = input.expertise;
      if (input.experience_years !== undefined) {
        profile.experienceYears = input.experience_years;
      }
      if (input.education !== undefined) profile.education = input.education;
      if (input.portfolio_url !== undefined)
        profile.portfolioUrl = input.portfolio_url;
      if (input.refund_policy !== undefined)
        profile.refundPolicy = input.refund_policy;
      if (input.digital_license !== undefined) {
        profile.digitalLicense = input.digital_license;
      }

      await manager.save(Merchant, merchant);
      await manager.save(MerchantProfile, profile);
    });

    return this.findMyMerchant(userId).then((response) => ({
      ...response,
      responseMessage: 'Update my merchant success',
    }));
  }

  async findNotificationPreferences(userId: string) {
    await this.assertMerchantOwner(userId);
    const preferences = await this.notificationPreferences.findOneBy({
      userId,
    });
    return {
      data: this.toNotificationPreferences(preferences),
      responseMessage: 'Get notification preferences success',
    };
  }

  async updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferencesDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.findOwnedMerchant(manager, userId, true);
      let preferences = await manager.findOneBy(UserNotificationPreferences, {
        userId,
      });
      if (!preferences) {
        preferences = manager.create(UserNotificationPreferences, { userId });
      }

      if (input.email_new_sale !== undefined) {
        preferences.emailNewSale = input.email_new_sale;
      }
      if (input.email_new_applicant !== undefined) {
        preferences.emailNewApplicant = input.email_new_applicant;
      }
      if (input.email_new_review !== undefined) {
        preferences.emailNewReview = input.email_new_review;
      }
      if (input.email_weekly_report !== undefined) {
        preferences.emailWeeklyReport = input.email_weekly_report;
      }
      if (input.whatsapp_new_order !== undefined) {
        preferences.whatsappNewOrder = input.whatsapp_new_order;
      }
      if (input.whatsapp_payout_approved !== undefined) {
        preferences.whatsappPayoutApproved = input.whatsapp_payout_approved;
      }
      if (input.whatsapp_student_chat !== undefined) {
        preferences.whatsappStudentChat = input.whatsapp_student_chat;
      }
      if (input.promotion_broadcast !== undefined) {
        preferences.promotionBroadcast = input.promotion_broadcast;
      }
      await manager.save(UserNotificationPreferences, preferences);
    });

    return this.findNotificationPreferences(userId).then((response) => ({
      ...response,
      responseMessage: 'Update notification preferences success',
    }));
  }

  private async ensureMerchantProfile(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findOwnedMerchant(manager, userId, true);
      const profile = await manager.findOneBy(MerchantProfile, {
        merchantId: merchant.id,
      });
      if (!profile) {
        await manager.save(
          MerchantProfile,
          manager.create(MerchantProfile, {
            merchantId: merchant.id,
            slug: await this.nextAvailableSlug(manager, merchant.storeName),
          }),
        );
      }
    });
  }

  private async findMerchantResponse(
    userId: string,
  ): Promise<MerchantResponseDto> {
    const row = await this.merchants
      .createQueryBuilder('merchant')
      .innerJoin(
        MerchantProfile,
        'profile',
        'profile.merchant_id = merchant.id AND profile.deleted_at IS NULL',
      )
      .leftJoin(
        Profile,
        'user_profile',
        'user_profile.user_id = merchant.user_id AND user_profile.deleted_at IS NULL',
      )
      .select([
        'merchant.id AS id',
        'merchant.store_name AS store_name',
        'merchant.store_description AS store_description',
        'merchant.status AS status',
        'profile.slug AS slug',
        'user_profile.phone AS phone',
        'profile.tagline AS tagline',
        'profile.category_label AS category_label',
        'profile.city AS city',
        'profile.public_email AS public_email',
        'profile.public_phone AS public_phone',
        'profile.website_url AS website_url',
        'profile.instagram_handle AS instagram_handle',
        'profile.youtube_url AS youtube_url',
        'profile.linkedin_url AS linkedin_url',
        'profile.expertise AS expertise',
        'profile.experience_years AS experience_years',
        'profile.education AS education',
        'profile.portfolio_url AS portfolio_url',
        'profile.refund_policy AS refund_policy',
        'profile.digital_license AS digital_license',
        'profile.terms_accepted_at AS terms_accepted_at',
      ])
      .where('merchant.user_id = :userId', { userId })
      .andWhere('merchant.deleted_at IS NULL')
      .getRawOne<MerchantRow>();
    if (!row) throw new NotFoundException('Merchant not found');

    return {
      ...row,
      experience_years:
        row.experience_years === null ? null : Number(row.experience_years),
    };
  }

  private async assertMerchantOwner(userId: string): Promise<void> {
    const merchant = await this.merchants.findOneBy({ userId });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }

  private async findOwnedMerchant(
    manager: EntityManager,
    userId: string,
    lock = false,
  ): Promise<Merchant> {
    const merchant = await manager.findOne(Merchant, {
      where: { userId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  private async savePrivatePhone(
    manager: EntityManager,
    userId: string,
    phone: string,
  ): Promise<void> {
    const profile = await manager.findOneBy(Profile, { userId });
    await manager.save(
      Profile,
      profile
        ? Object.assign(profile, { phone })
        : manager.create(Profile, { userId, phone }),
    );
  }

  private async nextAvailableSlug(
    manager: EntityManager,
    storeName: string,
  ): Promise<string> {
    const baseSlug = this.toSlug(storeName);
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      baseSlug,
    ]);
    const rows = (await manager.query(
      'SELECT slug FROM merchant_profiles WHERE slug = $1 OR slug ~ $2',
      [baseSlug, `^${baseSlug}-[0-9]+$`],
    )) as Array<{ slug: string }>;
    const used = new Set(rows.map((row) => row.slug));
    if (!used.has(baseSlug)) return baseSlug;

    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${baseSlug}-${suffix}`;
      if (!used.has(candidate)) return candidate;
    }
  }

  private toSlug(value: string): string {
    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    return slug || 'merchant';
  }

  private toNotificationPreferences(
    preferences: UserNotificationPreferences | null,
  ): NotificationPreferencesResponseDto {
    return {
      email_new_sale: preferences?.emailNewSale ?? true,
      email_new_applicant: preferences?.emailNewApplicant ?? true,
      email_new_review: preferences?.emailNewReview ?? true,
      email_weekly_report: preferences?.emailWeeklyReport ?? true,
      whatsapp_new_order: preferences?.whatsappNewOrder ?? true,
      whatsapp_payout_approved: preferences?.whatsappPayoutApproved ?? true,
      whatsapp_student_chat: preferences?.whatsappStudentChat ?? false,
      promotion_broadcast: preferences?.promotionBroadcast ?? true,
    };
  }
}

interface MerchantRow extends Omit<MerchantResponseDto, 'experience_years'> {
  experience_years: string | null;
}
