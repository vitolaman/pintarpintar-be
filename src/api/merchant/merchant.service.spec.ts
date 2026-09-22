import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant } from './entities/merchant.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { MerchantService } from './merchant.service';

describe('MerchantService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let query: jest.Mock;
  let dataSource: Pick<DataSource, 'transaction' | 'query'>;
  let merchants: { findOneBy: jest.Mock };
  let preferences: { findOneBy: jest.Mock };
  let service: MerchantService;

  const registrationInput = {
    store_name: 'Akademi Teknik Raka',
    store_description: 'Kelas teknik untuk profesional.',
  };

  beforeEach(() => {
    query = jest.fn();
    manager = {
      create: jest.fn((target, value) => ({
        ...value,
        ...(target === Merchant ? { id: merchantId } : {}),
      })),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (_target, value) => value),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      query: query,
    } as unknown as Pick<DataSource, 'transaction' | 'query'>;
    merchants = { findOneBy: jest.fn() };
    preferences = { findOneBy: jest.fn() };
    service = new MerchantService(
      dataSource as DataSource,
      merchants as unknown as Repository<Merchant>,
      preferences as unknown as Repository<UserNotificationPreferences>,
    );
  });

  it('creates an active merchant, owner membership, profile, and capability', async () => {
    const user = { id: userId, name: 'Raka Wijaya', isMerchant: false } as User;
    manager.findOne.mockImplementation((target) =>
      target === User ? Promise.resolve(user) : Promise.resolve(null),
    );
    manager.findOneBy.mockResolvedValue(null);
    jest.spyOn(service, 'findMerchantProfile').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get merchant profile success',
    });

    await expect(service.register(userId, registrationInput)).resolves.toEqual({
      data: { id: merchantId },
      responseMessage: 'Register merchant success',
    });

    expect(user.isMerchant).toBe(true);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['akademi-teknik-raka'],
    );
    expect(manager.save).toHaveBeenCalledWith(
      Merchant,
      expect.objectContaining({
        userId,
        storeName: registrationInput.store_name,
        storeDescription: registrationInput.store_description,
        status: 'active',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      MerchantProfile,
      expect.objectContaining({
        merchantId,
        slug: 'akademi-teknik-raka',
      }),
    );
  });

  it('rejects a second owned merchant before creating new state', async () => {
    manager.findOne.mockImplementation((target) =>
      target === User
        ? Promise.resolve({ id: userId, name: 'Raka Wijaya' })
        : Promise.resolve({ id: merchantId }),
    );

    await expect(
      service.register(userId, registrationInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('uses the next numeric suffix when the generated slug is already occupied', async () => {
    manager.findOne.mockImplementation((target) =>
      target === User
        ? Promise.resolve({ id: userId, name: 'Raka Wijaya' })
        : Promise.resolve(null),
    );
    manager.findOneBy.mockResolvedValue(null);
    manager.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { slug: 'akademi-teknik-raka' },
        { slug: 'akademi-teknik-raka-2' },
      ]);
    jest.spyOn(service, 'findMerchantProfile').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get merchant profile success',
    });

    await service.register(userId, registrationInput);

    expect(manager.save).toHaveBeenCalledWith(
      MerchantProfile,
      expect.objectContaining({ slug: 'akademi-teknik-raka-3' }),
    );
  });

  it('preserves the existing slug when the owner changes store name', async () => {
    const merchant = {
      id: merchantId,
      userId,
      storeName: 'Raka Wijaya',
    } as Merchant;
    const profile = {
      merchantId,
      slug: 'raka-wijaya',
    } as MerchantProfile;
    manager.findOne.mockResolvedValue(merchant);
    manager.findOneBy.mockResolvedValue(profile);
    jest.spyOn(service, 'findMerchantProfile').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get merchant profile success',
    });

    await service.updateMerchantProfile(userId, {
      store_name: 'Akademi Teknik',
    });

    expect(merchant.storeName).toBe('Akademi Teknik');
    expect(profile.slug).toBe('raka-wijaya');
  });

  it('stores a canonical category and clears it when null is submitted', async () => {
    const merchant = {
      id: merchantId,
      userId,
      storeName: 'Raka Wijaya',
    } as Merchant;
    const profile = {
      merchantId,
      slug: 'raka-wijaya',
      categoryLabel: 'Bisnis & Manajemen',
    } as MerchantProfile;
    manager.findOne.mockResolvedValue(merchant);
    manager.findOneBy.mockResolvedValue(profile);
    jest.spyOn(service, 'findMerchantProfile').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get merchant profile success',
    });

    await service.updateMerchantProfile(userId, {
      category_label: 'Teknik & Arsitektur',
    });
    expect(profile.categoryLabel).toBe('Teknik & Arsitektur');

    await service.updateMerchantProfile(userId, { category_label: null });
    expect(profile.categoryLabel).toBeNull();
  });

  it('leaves the stored category unchanged when the field is omitted', async () => {
    const merchant = {
      id: merchantId,
      userId,
      storeName: 'Raka Wijaya',
    } as Merchant;
    const profile = {
      merchantId,
      slug: 'raka-wijaya',
      categoryLabel: 'Desain & Kreatif',
    } as MerchantProfile;
    manager.findOne.mockResolvedValue(merchant);
    manager.findOneBy.mockResolvedValue(profile);
    jest.spyOn(service, 'findMerchantProfile').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get merchant profile success',
    });

    await service.updateMerchantProfile(userId, { city: 'Bandung' });

    expect(profile.categoryLabel).toBe('Desain & Kreatif');
  });

  it('returns a public storefront with stats and a derived category slug', async () => {
    query.mockResolvedValueOnce([
      {
        id: merchantId,
        store_name: 'Akademi Teknik Raka',
        store_description: 'Kelas teknik untuk profesional.',
        slug: 'akademi-teknik-raka',
        tagline: 'Belajar teknologi dari praktisi.',
        category_label: 'Teknik & Arsitektur',
        city: 'Bandung',
        public_email: 'contact@akademi.example',
        public_phone: '+62 812-3456-7890',
        website_url: null,
        instagram_handle: null,
        youtube_url: null,
        linkedin_url: null,
        expertise: 'AutoCAD',
        avatar_asset_id: null,
        avatar_object_key: null,
        cover_asset_id: null,
        cover_object_key: null,
        created_at: new Date('2026-01-05T00:00:00.000Z'),
        total_students: '10',
        published_class_count: '2',
        published_digital_product_count: '3',
        average_rating: '4.8',
        review_count: '45',
      },
    ]);

    await expect(
      service.findPublicStorefront('akademi-teknik-raka'),
    ).resolves.toEqual({
      data: {
        id: merchantId,
        store_name: 'Akademi Teknik Raka',
        store_description: 'Kelas teknik untuk profesional.',
        slug: 'akademi-teknik-raka',
        tagline: 'Belajar teknologi dari praktisi.',
        category_label: 'Teknik & Arsitektur',
        category_slug: 'teknik-arsitektur',
        city: 'Bandung',
        public_email: 'contact@akademi.example',
        public_phone: '+62 812-3456-7890',
        website_url: null,
        instagram_handle: null,
        youtube_url: null,
        linkedin_url: null,
        expertise: 'AutoCAD',
        avatar_asset_id: null,
        avatar_object_key: null,
        cover_asset_id: null,
        cover_object_key: null,
        created_at: new Date('2026-01-05T00:00:00.000Z'),
        total_students: 10,
        published_class_count: 2,
        published_digital_product_count: 3,
        average_rating: 4.8,
        review_count: 45,
      },
      responseMessage: 'Get public merchant success',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('profile.slug = $1'),
      ['akademi-teknik-raka'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.not.stringContaining('lifetime_earnings'),
      expect.anything(),
    );
    expect(query).toHaveBeenCalledWith(
      expect.not.stringContaining('balance'),
      expect.anything(),
    );
  });

  it('hides merchants whose slug does not resolve to an active merchant', async () => {
    query.mockResolvedValueOnce([]);

    await expect(
      service.findPublicStorefront('unknown-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns safe default notification preferences for a merchant without a row', async () => {
    merchants.findOneBy.mockResolvedValue({ id: merchantId } as Merchant);
    preferences.findOneBy.mockResolvedValue(null);

    await expect(service.findNotificationPreferences(userId)).resolves.toEqual({
      data: {
        email_new_sale: true,
        email_new_applicant: true,
        email_new_review: true,
        email_weekly_report: true,
        whatsapp_new_order: true,
        whatsapp_payout_approved: true,
        whatsapp_student_chat: false,
        promotion_broadcast: true,
      },
      responseMessage: 'Get notification preferences success',
    });
  });

  it('does not expose notification settings to a user without a merchant', async () => {
    merchants.findOneBy.mockResolvedValue(null);

    await expect(
      service.findNotificationPreferences(userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UpdateMerchantProfileDto category_label', () => {
  const build = (value: unknown) =>
    plainToInstance(UpdateMerchantProfileDto, { category_label: value });

  it('accepts a canonical category label', async () => {
    const errors = await validate(build('Teknik & Arsitektur'));
    expect(errors).toHaveLength(0);
  });

  it('rejects a category label outside the canonical list', async () => {
    const errors = await validate(build('Kuliner & Jasa'));
    expect(errors.some((error) => error.property === 'category_label')).toBe(
      true,
    );
  });

  it('allows null so the merchant can clear its category', async () => {
    const errors = await validate(build(null));
    expect(errors).toHaveLength(0);
  });
});
