import {
  BadRequestException,
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
import { UpdatePayoutAccountDto } from './dto/update-payout-account.dto';
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

  it.each([[undefined], ['']])(
    'stores the account number as plain text without a key (%j)',
    (key) => {
      const cipher = new AccountNumberCipher(key);

      expect(cipher.encrypt('8830192841')).toBe('8830192841');
      expect(cipher.decrypt('8830192841')).toBe('8830192841');
    },
  );

  it('reads plain values stored before a key was configured', () => {
    expect(new AccountNumberCipher(KEY).decrypt('8830192841')).toBe(
      '8830192841',
    );
  });

  it.each([['short'], [randomBytes(16).toString('base64')]])(
    'rejects a malformed key (%j)',
    (key) => {
      expect(() => new AccountNumberCipher(key).encrypt('123456')).toThrow(
        InternalServerErrorException,
      );
    },
  );

  it('cannot read an encrypted value without the key', () => {
    const envelope = new AccountNumberCipher(KEY).encrypt('8830192841');

    expect(() => new AccountNumberCipher(undefined).decrypt(envelope)).toThrow(
      InternalServerErrorException,
    );
  });

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
    [{ account_holder_name: '   ' }],
    [{ account_holder_name: null }],
  ])('rejects %j', async (override) => {
    expect(await errorsFor({ ...valid, ...override })).not.toHaveLength(0);
  });

  it('matches the bank name ignoring case and spaces', async () => {
    const dto = plainToInstance(CreatePayoutAccountDto, {
      ...valid,
      bank_name: '  bank syariah indonesia (bsi) ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.bank_name).toBe('Bank Syariah Indonesia (BSI)');
  });
});

describe('is_primary input', () => {
  const errorFields = async (input: Record<string, unknown>) =>
    (await validate(plainToInstance(UpdatePayoutAccountDto, input))).map(
      (error) => error.property,
    );

  it.each([true, false])('accepts %j', async (is_primary) => {
    expect(await errorFields({ is_primary })).toEqual([]);
  });

  it.each([null, 'yes', 1])('rejects %j', async (is_primary) => {
    expect(await errorFields({ is_primary })).toEqual(['is_primary']);
  });
});

describe('UpdatePayoutAccountDto', () => {
  const errorFields = async (input: Record<string, unknown>) =>
    (await validate(plainToInstance(UpdatePayoutAccountDto, input))).map(
      (error) => error.property,
    );

  it('allows omitting every field', async () => {
    expect(await errorFields({})).toEqual([]);
  });

  it.each(['', '  ', null])(
    'rejects an account holder name of %j',
    async (account_holder_name) => {
      expect(await errorFields({ account_holder_name })).toEqual([
        'account_holder_name',
      ]);
    },
  );

  it('rejects a null bank name', async () => {
    expect(await errorFields({ bank_name: null })).toEqual(['bank_name']);
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

  describe('is_primary', () => {
    const merchantLock = () =>
      manager.findOne.mock.calls.findIndex(
        ([target, options]) =>
          target === Merchant && options.lock?.mode === 'pessimistic_write',
      );
    const order = (mock: jest.Mock) => mock.mock.invocationCallOrder[0];

    it('makes a new account primary after clearing the others under the merchant lock', async () => {
      manager.count.mockResolvedValue(2);

      const { data } = await service.create('user-id', {
        ...input,
        is_primary: true,
      });

      expect(merchantLock()).toBe(0);
      expect(manager.update).toHaveBeenCalledWith(
        MerchantPayoutAccount,
        { merchantId: 'merchant-id', isPrimary: true },
        { isPrimary: false },
      );
      expect(order(manager.findOne)).toBeLessThan(order(manager.update));
      expect(order(manager.update)).toBeLessThan(order(manager.save));
      expect(manager.save.mock.calls[0][1].isPrimary).toBe(true);
      expect(data.is_primary).toBe(true);
    });

    it('keeps a new account non-primary with false', async () => {
      manager.count.mockResolvedValue(1);

      const { data } = await service.create('user-id', {
        ...input,
        is_primary: false,
      });

      expect(manager.update).not.toHaveBeenCalled();
      expect(data.is_primary).toBe(false);
    });

    it('rejects false for the first account', async () => {
      manager.count.mockResolvedValue(0);

      await expect(
        service.create('user-id', { ...input, is_primary: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('switches the primary on update in one transaction under the merchant lock', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'b',
        isPrimary: false,
        verificationStatus: 'verified',
      });

      const { data } = await service.update('user-id', 'b', {
        is_primary: true,
      });

      expect(merchantLock()).toBe(0);
      expect(manager.update).toHaveBeenCalledTimes(1);
      const [target, criteria, values] = manager.update.mock.calls[0];
      expect(target).toBe(MerchantPayoutAccount);
      expect(criteria).toMatchObject({
        merchantId: 'merchant-id',
        isPrimary: true,
      });
      expect(criteria.id.value).toBe('b');
      expect(values).toEqual({ isPrimary: false });
      expect(order(manager.update)).toBeLessThan(order(manager.save));
      expect(data).toMatchObject({
        id: 'b',
        is_primary: true,
        verification_status: 'verified',
      });
    });

    it('keeps one primary when two switches race', async () => {
      // Models the pessimistic merchant row lock: a locking read waits until
      // the transaction holding the row ends. Without it the two requests
      // interleave and both accounts end up primary.
      const accounts = {
        a: { id: 'a', isPrimary: true },
        b: { id: 'b', isPrimary: false },
        c: { id: 'c', isPrimary: false },
      };
      let rowReleased = Promise.resolve();
      const transaction = jest.fn(async (callback) => {
        const releases: (() => void)[] = [];
        const lockingManager = {
          ...manager,
          findOne: jest.fn(async (target, options) => {
            if (target === Merchant && options.lock) {
              const previous = rowReleased;
              rowReleased = new Promise((resolve) =>
                releases.push(() => resolve()),
              );
              await previous;
            }
            return manager.findOne(target, options);
          }),
        };
        try {
          return await callback(lockingManager);
        } finally {
          releases.forEach((release) => release());
        }
      });
      manager.findOneBy.mockImplementation(async (_target, { id }) => ({
        ...accounts[id],
      }));
      manager.update.mockImplementation(async (_target, criteria) => {
        for (const account of Object.values(accounts)) {
          if (account.isPrimary && account.id !== criteria.id?.value) {
            account.isPrimary = false;
          }
        }
      });
      manager.save.mockImplementation(async (_target, value) => {
        accounts[value.id].isPrimary = value.isPrimary;
        return value;
      });
      service = new PayoutAccountService({
        manager,
        transaction,
      } as unknown as DataSource);

      await Promise.all([
        service.update('user-id', 'b', { is_primary: true }),
        service.update('user-id', 'c', { is_primary: true }),
      ]);

      const primaries = Object.values(accounts).filter(
        (account) => account.isPrimary,
      );
      expect(primaries.map((account) => account.id)).toEqual(['c']);
    });

    it('rejects false for the current primary and changes nothing', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'a', isPrimary: true });

      await expect(
        service.update('user-id', 'a', {
          account_holder_name: 'X',
          is_primary: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('leaves a non-primary account and the others alone with false', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'b', isPrimary: false });

      const { data } = await service.update('user-id', 'b', {
        is_primary: false,
      });

      expect(manager.update).not.toHaveBeenCalled();
      expect(data.is_primary).toBe(false);
    });
  });
});
