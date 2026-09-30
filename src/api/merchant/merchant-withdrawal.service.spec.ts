import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { MerchantPayoutAccount } from '../payout-account/entities/merchant-payout-account.entity';
import { RequestWithdrawalDto } from './dto/withdrawal.dto';
import { MerchantPayout } from './entities/merchant-payout.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantService } from './merchant.service';
import { MerchantWithdrawalService } from './merchant-withdrawal.service';

const ACCOUNT_ID = '20000000-0000-4000-8000-000000000001';

describe('MerchantWithdrawalService', () => {
  const execute = jest.fn();
  const setParameter = jest.fn();
  const builder = {
    update: () => builder,
    set: () => builder,
    where: () => builder,
    setParameter: (name: string, value: unknown) => {
      setParameter(name, value);
      return builder;
    },
    execute,
  };
  const account = {
    id: ACCOUNT_ID,
    bankName: 'BCA',
    maskedAccountNumber: '•••• 2841',
    accountHolderName: 'Budi Santoso',
  };
  let manager: Record<string, jest.Mock | (() => typeof builder)>;
  let service: MerchantWithdrawalService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = {
      findOneBy: jest.fn(async (entity, where) => {
        if (entity === Merchant) return { id: 'merchant-id' };
        if (entity === MerchantPayoutAccount) {
          return where.id === ACCOUNT_ID || where.isPrimary ? account : null;
        }
        return null;
      }),
      findOne: jest.fn(async () => ({
        id: 'wallet-id',
        settledBalance: '500000',
      })),
      createQueryBuilder: () => builder,
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => ({
        id: 'payout-id',
        requestedAt: new Date('2026-09-30T00:00:00Z'),
        ...value,
      })),
    };
    service = new MerchantWithdrawalService(
      {
        transaction: (work: (m: typeof manager) => unknown) => work(manager),
      } as unknown as DataSource,
      {
        findWallet: async () => ({ data: { settled_balance: 300000 } }),
      } as unknown as MerchantService,
    );
  });

  it('reserves the amount and records a pending withdrawal with the fee', async () => {
    const { data } = await service.request('user-id', { amount: 200000 });

    expect(setParameter).toHaveBeenCalledWith('amount', 200000);
    expect(manager.save).toHaveBeenCalledWith(
      MerchantPayout,
      expect.objectContaining({
        merchantId: 'merchant-id',
        payoutAccountId: ACCOUNT_ID,
        amount: '200000',
        feeAmount: '5000',
        status: 'pending',
        destinationBankAccount: 'BCA •••• 2841 a.n. Budi Santoso',
      }),
    );
    expect(data).toMatchObject({
      amount: 200000,
      fee_amount: 5000,
      transfer_amount: 195000,
      wallet: { settled_balance: 300000 },
    });
  });

  it('rejects an amount above the settled balance without changes', async () => {
    await expect(
      service.request('user-id', { amount: 600000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('requires a primary account when none is chosen', async () => {
    (manager.findOneBy as jest.Mock).mockImplementation(async (entity) =>
      entity === Merchant ? { id: 'merchant-id' } : null,
    );
    await expect(
      service.request('user-id', { amount: 200000 }),
    ).rejects.toThrow('Add a primary payout account first');
  });

  it("rejects another merchant's account", async () => {
    await expect(
      service.request('user-id', {
        amount: 200000,
        payout_account_id: '20000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [{ amount: 99999 }, true],
    [{ amount: 150000.5 }, true],
    [{ amount: 100000, payout_account_id: 'nope' }, true],
    [{ amount: 100000 }, false],
  ])('validates %j', async (input, hasErrors) => {
    const errors = await validate(plainToInstance(RequestWithdrawalDto, input));
    expect(errors.length > 0).toBe(hasErrors);
  });
});
