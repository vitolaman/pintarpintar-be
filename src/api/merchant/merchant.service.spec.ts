import { MerchantLevelService } from '../merchant-level/merchant-level.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant, MerchantStorageLevel } from './entities/merchant.entity';
import { MerchantWallet } from './entities/merchant-wallet.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { MerchantService } from './merchant.service';

const LEVEL = {
  current: 'basic',
  current_month_revenue: 0,
  silver_threshold: 2500000,
  gold_threshold: 5000000,
  max_upload_bytes: 1073741824,
  storage_quota_bytes: 32212254720,
  last_evaluated_month: null,
  next_evaluation_at: '2026-11-01T00:30:00+07:00',
  inactivity_warning: false,
};

describe('MerchantService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let query: jest.Mock;
  let dataSource: Pick<DataSource, 'transaction' | 'query' | 'manager'>;
  let merchants: { findOneBy: jest.Mock };
  let wallets: { findOneBy: jest.Mock; query: jest.Mock };
  let preferences: { findOneBy: jest.Mock };
  let levelSummary: { findSummary: jest.Mock };
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
      manager: { find: jest.fn().mockResolvedValue([]) },
    } as unknown as Pick<DataSource, 'transaction' | 'query' | 'manager'>;
    merchants = { findOneBy: jest.fn() };
    wallets = { findOneBy: jest.fn(), query: jest.fn() };
    preferences = { findOneBy: jest.fn() };
    levelSummary = { findSummary: jest.fn().mockResolvedValue(LEVEL) };
    service = new MerchantService(
      dataSource as DataSource,
      merchants as unknown as Repository<Merchant>,
      wallets as unknown as Repository<MerchantWallet>,
      preferences as unknown as Repository<UserNotificationPreferences>,
      levelSummary as unknown as MerchantLevelService,
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
        storageLevel: MerchantStorageLevel.BASIC,
        status: 'active',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      MerchantWallet,
      expect.objectContaining({
        merchantId,
        earningBalance: '0',
        settledBalance: '0',
        lifetimeEarnings: '0',
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

  it('returns only the authenticated merchant wallet amounts', async () => {
    merchants.findOneBy.mockResolvedValue({
      id: merchantId,
      userId,
      storageLevel: MerchantStorageLevel.SILVER,
    });
    wallets.findOneBy.mockResolvedValue({
      merchantId,
      earningBalance: '13700000.50',
      settledBalance: '12500000',
      lifetimeEarnings: '58700000',
    });
    wallets.query.mockResolvedValue([{ total: '45000000' }]);

    await expect(service.findWallet(userId)).resolves.toEqual({
      data: {
        merchant_id: merchantId,
        storage_level: MerchantStorageLevel.SILVER,
        earning_balance: 13700000.5,
        settled_balance: 12500000,
        clearing_balance: 1200000.5,
        lifetime_earnings: 58700000,
        total_withdrawn: 45000000,
      },
      responseMessage: 'Get merchant wallet success',
    });

    expect(wallets.findOneBy).toHaveBeenCalledWith({ merchantId });
    expect(wallets.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'success'"),
      [merchantId],
    );
  });

  it('rejects wallet access for a user without a merchant', async () => {
    merchants.findOneBy.mockResolvedValue(null);

    await expect(service.findWallet(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(wallets.findOneBy).not.toHaveBeenCalled();
  });

  it('returns the merchant balance history with paging metadata', async () => {
    merchants.findOneBy.mockResolvedValue({ id: merchantId, userId });
    query.mockResolvedValueOnce([{ total: 3 }]).mockResolvedValueOnce([
      {
        id: 'payout-id',
        type: 'withdraw',
        amount: '5000000',
        description: 'Bank BCA •••• 8912',
        occurred_at: new Date('2026-09-28T03:00:00Z'),
        status: 'success',
      },
    ]);

    const result = await service.findBalanceHistory(userId, {
      type: 'all',
      page: 2,
      limit: 2,
    });

    expect(query.mock.calls[0][1]).toEqual([merchantId, 'all']);
    expect(query.mock.calls[1][1]).toEqual([merchantId, 'all', 2, 2]);
    expect(query.mock.calls[1][0]).toContain("purchase.status = 'paid'");
    expect(query.mock.calls[1][0]).toContain(
      'INNER JOIN bundles bundle ON bundle.id = item.bundle_id',
    );
    expect(result).toEqual({
      data: [
        {
          id: 'payout-id',
          type: 'withdraw',
          amount: 5000000,
          description: 'Bank BCA •••• 8912',
          occurred_at: new Date('2026-09-28T03:00:00Z'),
          status: 'success',
        },
      ],
      meta: { page: 2, limit: 2, total: 3, totalPage: 2 },
      responseMessage: 'Get balance history success',
    });
  });

  it('rejects balance history for a user without a merchant', async () => {
    merchants.findOneBy.mockResolvedValue(null);
    await expect(
      service.findBalanceHistory(userId, { type: 'all', page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
  });

  it('includes the storage tier in the merchant profile response', async () => {
    const row = {
      id: merchantId,
      store_name: registrationInput.store_name,
      store_description: registrationInput.store_description,
      status: 'active',
      storage_level: MerchantStorageLevel.SILVER,
      slug: 'akademi-teknik-raka',
      experience_years: null,
    };
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(row),
    };
    (merchants as Record<string, jest.Mock>).createQueryBuilder = jest
      .fn()
      .mockReturnValue(queryBuilder);
    (dataSource.manager.find as jest.Mock).mockResolvedValueOnce([
      { name: 'AutoCAD' },
      { name: 'SAP2000' },
    ]);

    await expect(
      (
        service as unknown as {
          findMerchantResponse: (userId: string) => Promise<unknown>;
        }
      ).findMerchantResponse(userId),
    ).resolves.toEqual({
      ...row,
      experience_years: null,
      avatar_url: null,
      cover_url: null,
      skills: ['AutoCAD', 'SAP2000'],
      level: LEVEL,
      landing: {
        background_asset_id: undefined,
        background_object_key: undefined,
        background_url: null,
        section_order: [
          'best_seller',
          'bootcamp',
          'kelas',
          'digital',
          'bundles',
        ],
        item_order: {},
      },
    });

    expect(queryBuilder.select).toHaveBeenCalledWith(
      expect.arrayContaining(['merchant.storage_level AS storage_level']),
    );
    expect(levelSummary.findSummary).toHaveBeenCalledWith(merchantId);
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
        owner_user_id: userId,
        landing_background_asset_id: null,
        landing_background_object_key: null,
        landing_layout: null,
        skills: ['AutoCAD'],
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
        avatar_url: null,
        cover_url: null,
        skills: ['AutoCAD'],
        landing: {
          background_asset_id: null,
          background_object_key: null,
          background_url: null,
          section_order: [
            'best_seller',
            'bootcamp',
            'kelas',
            'digital',
            'bundles',
          ],
          item_order: {},
        },
        is_owner: false,
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

  it('resolves the storefront by id and flags the signed-in owner', async () => {
    query.mockResolvedValueOnce([
      {
        id: merchantId,
        owner_user_id: userId,
        category_label: null,
        landing_layout: null,
        skills: [],
        total_students: 0,
        published_class_count: 0,
        published_digital_product_count: 0,
        average_rating: '0',
        review_count: 0,
      },
    ]);

    const response = await service.findPublicStorefront(merchantId, userId);

    expect(response.data.is_owner).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('merchant.id = $1::uuid'),
      [merchantId],
    );
  });

  it('never marks another signed-in user as the owner', async () => {
    query.mockResolvedValueOnce([
      {
        id: merchantId,
        owner_user_id: userId,
        landing_layout: null,
        skills: [],
      },
    ]);

    const response = await service.findPublicStorefront(
      merchantId,
      '99999999-0000-4000-8000-000000000009',
    );

    expect(response.data.is_owner).toBe(false);
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

describe('BalanceHistoryQueryDto', () => {
  it('rejects an unknown entry type', async () => {
    const errors = await validate(
      plainToInstance(BalanceHistoryQueryDto, { type: 'refund' }),
    );
    expect(errors).not.toHaveLength(0);
  });

  it('clamps paging instead of rejecting it', async () => {
    const query = plainToInstance(BalanceHistoryQueryDto, {
      page: '0',
      limit: '101',
    });
    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({ page: 1, limit: 100 });
  });
});
