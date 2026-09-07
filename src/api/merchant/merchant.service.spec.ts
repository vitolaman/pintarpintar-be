import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant } from './entities/merchant.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { MerchantService } from './merchant.service';

describe('MerchantService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let dataSource: Pick<DataSource, 'transaction'>;
  let merchants: { findOneBy: jest.Mock };
  let preferences: { findOneBy: jest.Mock };
  let service: MerchantService;

  const registrationInput = {
    phone: '+62 812-3456-7890',
    expertise: 'Frontend engineering',
    experience_years: 4,
    education: 'S1 Teknik Informatika',
    bio: 'Berpengalaman membangun produk web.',
    terms_accepted: true,
  };

  beforeEach(() => {
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
    } as unknown as Pick<DataSource, 'transaction'>;
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
    jest.spyOn(service, 'findMyMerchant').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get my merchant success',
    });

    await expect(service.register(userId, registrationInput)).resolves.toEqual({
      data: { id: merchantId },
      responseMessage: 'Register merchant success',
    });

    expect(user.isMerchant).toBe(true);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['raka-wijaya'],
    );
    expect(manager.save).toHaveBeenCalledWith(
      Merchant,
      expect.objectContaining({
        userId,
        storeName: 'Raka Wijaya',
        storeDescription: registrationInput.bio,
        status: 'active',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      MerchantProfile,
      expect.objectContaining({
        merchantId,
        slug: 'raka-wijaya',
        expertise: registrationInput.expertise,
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
        { slug: 'raka-wijaya' },
        { slug: 'raka-wijaya-2' },
      ]);
    jest.spyOn(service, 'findMyMerchant').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get my merchant success',
    });

    await service.register(userId, registrationInput);

    expect(manager.save).toHaveBeenCalledWith(
      MerchantProfile,
      expect.objectContaining({ slug: 'raka-wijaya-3' }),
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
    jest.spyOn(service, 'findMyMerchant').mockResolvedValue({
      data: { id: merchantId } as never,
      responseMessage: 'Get my merchant success',
    });

    await service.updateMyMerchant(userId, {
      store_name: 'Akademi Teknik',
    });

    expect(merchant.storeName).toBe('Akademi Teknik');
    expect(profile.slug).toBe('raka-wijaya');
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
