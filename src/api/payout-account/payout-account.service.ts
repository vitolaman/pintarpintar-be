import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  AccountNumberCipher,
  maskAccountNumber,
} from './account-number-cipher';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';
import { PayoutAccountResponseDto } from './dto/payout-account-response.dto';
import { UpdatePayoutAccountDto } from './dto/update-payout-account.dto';
import { MerchantPayoutAccount } from './entities/merchant-payout-account.entity';
import {
  PayoutAccountEmailFacts,
  queuePayoutAccountChangedEmail,
} from '~/api/email/events/merchant-emails';
import type { PayoutAccountAction } from '~/api/email/templates/payloads';

const UNVERIFIED = 'unverified';

@Injectable()
export class PayoutAccountService {
  private readonly cipher = new AccountNumberCipher();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(userId: string) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    const accounts = await this.dataSource.manager.find(MerchantPayoutAccount, {
      where: { merchantId: merchant.id },
      order: { isPrimary: 'DESC', created_at: 'ASC', id: 'ASC' },
    });

    return {
      data: accounts.map((account) => this.toResponse(account)),
      responseMessage: 'Get payout accounts success',
    };
  }

  async create(userId: string, input: CreatePayoutAccountDto) {
    const account = await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const existingCount = await manager.count(MerchantPayoutAccount, {
        where: { merchantId: merchant.id },
      });
      if (existingCount === 0 && input.is_primary === false) {
        throw new BadRequestException(
          'The first payout account is always primary',
        );
      }

      const isPrimary = existingCount === 0 || input.is_primary === true;
      if (isPrimary && existingCount > 0) {
        await this.clearOtherPrimaries(manager, merchant.id);
      }

      const created = await manager.save(
        MerchantPayoutAccount,
        manager.create(MerchantPayoutAccount, {
          merchantId: merchant.id,
          bankName: input.bank_name,
          accountHolderName: input.account_holder_name,
          encryptedAccountNumber: this.cipher.encrypt(input.account_number),
          maskedAccountNumber: maskAccountNumber(input.account_number),
          verificationStatus: UNVERIFIED,
          isPrimary,
        }),
      );
      await queuePayoutAccountChangedEmail(
        manager,
        accountChange(created, 'added'),
      );
      return created;
    });

    return {
      data: this.toResponse(account),
      responseMessage: 'Create payout account success',
    };
  }

  async update(userId: string, id: string, input: UpdatePayoutAccountDto) {
    const account = await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const account = await this.findOwnedAccount(manager, merchant.id, id);
      if (input.is_primary === false && account.isPrimary) {
        throw new BadRequestException(
          'Make another payout account primary instead',
        );
      }

      if (input.bank_name !== undefined) account.bankName = input.bank_name;
      if (input.account_holder_name !== undefined) {
        account.accountHolderName = input.account_holder_name;
      }
      if (input.account_number !== undefined) {
        account.encryptedAccountNumber = this.cipher.encrypt(
          input.account_number,
        );
        account.maskedAccountNumber = maskAccountNumber(input.account_number);
      }
      // A changed destination has not been verified yet.
      if (
        input.bank_name !== undefined ||
        input.account_holder_name !== undefined ||
        input.account_number !== undefined
      ) {
        account.verificationStatus = UNVERIFIED;
      }
      const destinationChanged =
        input.bank_name !== undefined ||
        input.account_holder_name !== undefined ||
        input.account_number !== undefined;
      const madePrimary = input.is_primary === true && !account.isPrimary;
      if (madePrimary) {
        await this.clearOtherPrimaries(manager, merchant.id, account.id);
        account.isPrimary = true;
      }

      const saved = await manager.save(MerchantPayoutAccount, account);
      if (destinationChanged || madePrimary) {
        await queuePayoutAccountChangedEmail(
          manager,
          accountChange(saved, destinationChanged ? 'updated' : 'primary'),
        );
      }
      return saved;
    });

    return {
      data: this.toResponse(account),
      responseMessage: 'Update payout account success',
    };
  }

  async setPrimary(userId: string, id: string) {
    const account = await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const account = await this.findOwnedAccount(manager, merchant.id, id);

      const wasPrimary = account.isPrimary;
      await this.clearOtherPrimaries(manager, merchant.id, account.id);
      account.isPrimary = true;
      const saved = await manager.save(MerchantPayoutAccount, account);
      if (!wasPrimary) {
        await queuePayoutAccountChangedEmail(
          manager,
          accountChange(saved, 'primary'),
        );
      }
      return saved;
    });

    return {
      data: this.toResponse(account),
      responseMessage: 'Set primary payout account success',
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const account = await this.findOwnedAccount(manager, merchant.id, id);
      const wasPrimary = account.isPrimary;

      account.isPrimary = false;
      await manager.save(MerchantPayoutAccount, account);
      await manager.softRemove(MerchantPayoutAccount, account);
      await queuePayoutAccountChangedEmail(
        manager,
        accountChange(account, 'deleted'),
      );

      if (wasPrimary) {
        const successor = await manager.findOne(MerchantPayoutAccount, {
          where: { merchantId: merchant.id },
          order: { created_at: 'ASC', id: 'ASC' },
        });
        if (successor) {
          successor.isPrimary = true;
          await manager.save(MerchantPayoutAccount, successor);
        }
      }
    });
  }

  // Locking the merchant row serializes every payout-account change of one
  // merchant, so the single-primary rule holds under concurrent requests.
  private async findMerchant(
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

  // Runs before the new primary is saved: a partial unique index allows one
  // primary per merchant. Callers hold the merchant row lock.
  private async clearOtherPrimaries(
    manager: EntityManager,
    merchantId: string,
    keptAccountId?: string,
  ): Promise<void> {
    await manager.update(
      MerchantPayoutAccount,
      {
        merchantId,
        isPrimary: true,
        ...(keptAccountId ? { id: Not(keptAccountId) } : {}),
      },
      { isPrimary: false },
    );
  }

  private async findOwnedAccount(
    manager: EntityManager,
    merchantId: string,
    id: string,
  ): Promise<MerchantPayoutAccount> {
    const account = await manager.findOneBy(MerchantPayoutAccount, {
      id,
      merchantId,
    });
    if (!account) throw new NotFoundException('Payout account not found');
    return account;
  }

  private toResponse(account: MerchantPayoutAccount): PayoutAccountResponseDto {
    return {
      id: account.id,
      bank_name: account.bankName,
      account_holder_name: account.accountHolderName,
      masked_account_number: account.maskedAccountNumber,
      is_primary: account.isPrimary,
      verification_status: account.verificationStatus,
      created_at: account.created_at,
    };
  }
}

function accountChange(
  account: MerchantPayoutAccount,
  action: PayoutAccountAction,
): PayoutAccountEmailFacts {
  return {
    merchantId: account.merchantId,
    action,
    bankName: account.bankName,
    maskedAccountNumber: account.maskedAccountNumber,
    accountHolderName: account.accountHolderName,
  };
}
