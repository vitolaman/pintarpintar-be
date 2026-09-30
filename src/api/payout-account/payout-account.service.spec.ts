import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  AccountNumberCipher,
  maskAccountNumber,
} from './account-number-cipher';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';
import { MerchantPayoutAccount } from './entities/merchant-payout-account.entity';
import { PayoutAccountService } from './payout-account.service';

const KEY = randomBytes(32).toString('base64');

describe('AccountNumberCipher', () => {
  it('round-trips an account number without storing it in plain text', () => {
    const cipher = new AccountNumberCipher(KEY);
    const envelope = cipher.encrypt('8830192841');

    expect(envelope).not.toContain('8830192841');
    expect(envelope.startsWith('v1:')).toBe(true);
    expect(cipher.decrypt(envelope)).toBe('8830192841');
    expect(cipher.encrypt('8830192841')).not.toBe(envelope);
  });

  it.each([[undefined], ['short'], [randomBytes(16).toString('base64')]])(
    'rejects a missing or invalid key (%j)',
    (key) => {
      expect(() => new AccountNumberCipher(key).encrypt('123456')).toThrow(
        InternalServerErrorException,
      );
    },
  );

  it('masks all but the last four digits', () => {
    expect(maskAccountNumber('8830192841')).toBe('•••• 2841');
  });
});

describe('CreatePayoutAccountDto', () => {
  const errorsFor = (input: Record<string, unknown>) =>
    validate(plainToInstance(CreatePayoutAccountDto, input));
  const valid = {
    bank_name: 'Bank BCA',
    account_holder_name: ' Ahmad Santoso ',
    account_number: '8830-1928 41',
  };

  it('accepts a listed bank and normalizes spaces and dashes', async () => {
    const dto = plainToInstance(CreatePayoutAccountDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.account_number).toBe('8830192841');
    expect(dto.account_holder_name).toBe('Ahmad Santoso');
  });

  it.each([
    [{ bank_name: 'Bank Jago' }],
    [{ account_number: '88301A2841' }],
    [{ account_number: '12345' }],
    [{ account_holder_name: '' }],
  ])('rejects %j', async (override) => {
    expect(await errorsFor({ ...valid, ...override })).not.toHaveLength(0);
  });
});

describe('PayoutAccountService', () => {
  const merchant = { id: 'merchant-id', userId: 'user-id' } as Merchant;
  let manager: Record<string, jest.Mock>;
  let service: PayoutAccountService;

  beforeEach(() => {
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = KEY;
    manager = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(async (_target, value) => ({
        id: 'new-id',
        created_at: new Date('2026-09-30T00:00:00Z'),
        ...value,
      })),
      update: jest.fn(),
      softRemove: jest.fn(),
    };
    manager.findOne.mockImplementation(async (target) =>
      target === Merchant ? merchant : null,
    );
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource;
    service = new PayoutAccountService(dataSource);
  });

  afterEach(() => {
    delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
  });

  const input = {
    bank_name: 'Bank BCA',
    account_holder_name: 'Ahmad Santoso',
    account_number: '8830192841',
  } as CreatePayoutAccountDto;

  it('makes the first account primary, encrypts, and masks it', async () => {
    manager.count.mockResolvedValue(0);

    const { data } = await service.create('user-id', input);
    const saved = manager.save.mock.calls[0][1];

    expect(manager.findOne).toHaveBeenCalledWith(Merchant, {
      where: { userId: 'user-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(saved.isPrimary).toBe(true);
    expect(saved.encryptedAccountNumber).not.toContain('8830192841');
    expect(data).toMatchObject({
      bank_name: 'Bank BCA',
      masked_account_number: '•••• 2841',
      is_primary: true,
      verification_status: 'unverified',
    });
    expect(data).not.toHaveProperty('encryptedAccountNumber');
  });

  it('keeps later accounts non-primary', async () => {
    manager.count.mockResolvedValue(2);
    await service.create('user-id', input);
    expect(manager.save.mock.calls[0][1].isPrimary).toBe(false);
  });

  it('hides accounts of other merchants behind 404', async () => {
    manager.findOneBy.mockResolvedValue(null);

    await expect(
      service.update('user-id', 'foreign-id', { account_holder_name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.findOneBy).toHaveBeenCalledWith(MerchantPayoutAccount, {
      id: 'foreign-id',
      merchantId: 'merchant-id',
    });
  });

  it('rejects users without a merchant', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(service.findAll('user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('clears the previous primary before setting a new one', async () => {
    manager.findOneBy.mockResolvedValue({ id: 'b', isPrimary: false });

    const { data } = await service.setPrimary('user-id', 'b');

    expect(manager.update).toHaveBeenCalledWith(
      MerchantPayoutAccount,
      expect.objectContaining({ merchantId: 'merchant-id', isPrimary: true }),
      { isPrimary: false },
    );
    expect(data.is_primary).toBe(true);
  });

  it('promotes the oldest remaining account when the primary is deleted', async () => {
    const deleted = { id: 'a', isPrimary: true };
    const successor = { id: 'b', isPrimary: false };
    manager.findOneBy.mockResolvedValue(deleted);
    manager.findOne.mockImplementation(async (target) =>
      target === Merchant ? merchant : successor,
    );

    await service.remove('user-id', 'a');

    expect(manager.softRemove).toHaveBeenCalledWith(
      MerchantPayoutAccount,
      expect.objectContaining({ id: 'a', isPrimary: false }),
    );
    expect(successor.isPrimary).toBe(true);
  });

  it('re-marks an edited account as unverified', async () => {
    manager.findOneBy.mockResolvedValue({
      id: 'a',
      verificationStatus: 'verified',
      isPrimary: true,
    });

    const { data } = await service.update('user-id', 'a', {
      account_number: '1234567890',
    });

    expect(data).toMatchObject({
      masked_account_number: '•••• 7890',
      verification_status: 'unverified',
    });
  });
});
