import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Profile } from './entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { ProfileService } from './profile.service';

async function errorFields(value: object) {
  const errors = await validate(plainToInstance(UpdateOnboardingDto, value));
  return errors.map((error) => error.property);
}

describe('UpdateOnboardingDto', () => {
  it('normalizes skills', () => {
    const dto = plainToInstance(UpdateOnboardingDto, {
      role: 'professional',
      skills: [' AutoCAD', 'autocad', '', 'BIM'],
    });
    expect(dto.skills).toEqual(['AutoCAD', 'BIM']);
  });

  it.each([
    [{ role: 'mahasiswa', skills: [] }, []],
    [{ role: 'custom', custom_role: 'Konsultan Teknik', skills: [] }, []],
    [{ role: 'custom', skills: [] }, ['custom_role']],
    [{ role: 'custom', custom_role: '   ', skills: [] }, ['custom_role']],
    [{ role: 'pelajar', skills: [] }, ['role']],
    [{ role: 'mahasiswa' }, ['skills']],
    [
      {
        role: 'mahasiswa',
        skills: Array.from({ length: 21 }, (_, i) => `s${i}`),
      },
      ['skills'],
    ],
    [{ role: 'mahasiswa', skills: ['x'.repeat(51)] }, ['skills']],
    [{ role: 'mahasiswa', skills: [1] }, ['skills']],
  ])('validates %j', async (value, fields) => {
    expect(await errorFields(value)).toEqual(fields);
  });
});

describe('ProfileService.updateOnboarding', () => {
  let manager: Record<string, jest.Mock>;
  let service: ProfileService;
  let stored: Partial<Profile> | null;

  beforeEach(() => {
    stored = { userId: 'user-id', customRole: 'Lama' };
    manager = {
      findOneBy: jest.fn(async (target) =>
        target === User ? { id: 'user-id', isMentor: false } : stored,
      ),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (_target, value) => value),
    };
    service = new ProfileService(
      { transaction: jest.fn((callback) => callback(manager)) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
    jest.spyOn(service, 'findCurrent').mockResolvedValue({
      data: { onboarding: { role: 'brand_bisnis' } } as never,
      responseMessage: 'Get profile success',
    });
  });

  it('stores the answers and never touches the role flags', async () => {
    await expect(
      service.updateOnboarding('user-id', {
        role: 'brand_bisnis',
        custom_role: 'ignored',
        skills: ['AutoCAD'],
      }),
    ).resolves.toMatchObject({ responseMessage: 'Update onboarding success' });

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      Profile,
      expect.objectContaining({
        onboardingRole: 'brand_bisnis',
        customRole: null,
        skills: ['AutoCAD'],
        onboardingCompletedAt: expect.any(Date),
      }),
    );
    expect(manager.save).not.toHaveBeenCalledWith(User, expect.anything());
  });

  it('creates the profile row when missing', async () => {
    stored = null;
    await service.updateOnboarding('user-id', {
      role: 'custom',
      custom_role: 'Konsultan',
      skills: [],
    });
    expect(manager.create).toHaveBeenCalledWith(
      Profile,
      expect.objectContaining({ userId: 'user-id' }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      Profile,
      expect.objectContaining({ customRole: 'Konsultan' }),
    );
  });

  it('needs an existing user', async () => {
    manager.findOneBy.mockResolvedValue(null);
    await expect(
      service.updateOnboarding('user-id', { role: 'mahasiswa', skills: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
