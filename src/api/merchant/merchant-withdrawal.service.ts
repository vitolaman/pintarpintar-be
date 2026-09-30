import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MerchantPayoutAccount } from '../payout-account/entities/merchant-payout-account.entity';
import {
  RequestWithdrawalDto,
  WITHDRAWAL_FEE,
  WithdrawalResponseDto,
} from './dto/withdrawal.dto';
import {
  MerchantPayout,
  MerchantPayoutStatus,
} from './entities/merchant-payout.entity';
import { MerchantWallet } from './entities/merchant-wallet.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantService } from './merchant.service';

/**
 * "Tarik Saldo": reserves settled income for a manual transfer. The amount
 * leaves the earning and settled balances at once, so the same money cannot
 * be requested twice; a failed transfer is restored by the operator.
 */
@Injectable()
export class MerchantWithdrawalService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly merchantService: MerchantService,
  ) {}

  async request(userId: string, input: RequestWithdrawalDto) {
    const payout = await this.dataSource.transaction(async (manager) => {
      const merchant = await manager.findOneBy(Merchant, { userId });
      if (!merchant) throw new NotFoundException('Merchant not found');

      const wallet = await manager.findOne(MerchantWallet, {
        where: { merchantId: merchant.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Merchant wallet not found');
      if (input.amount > Number(wallet.settledBalance)) {
        throw new BadRequestException(
          'The amount exceeds the withdrawable balance',
        );
      }

      const account = input.payout_account_id
        ? await manager.findOneBy(MerchantPayoutAccount, {
            id: input.payout_account_id,
            merchantId: merchant.id,
          })
        : await manager.findOneBy(MerchantPayoutAccount, {
            merchantId: merchant.id,
            isPrimary: true,
          });
      if (!account) {
        if (input.payout_account_id) {
          throw new NotFoundException('Payout account not found');
        }
        throw new BadRequestException('Add a primary payout account first');
      }

      await manager
        .createQueryBuilder()
        .update(MerchantWallet)
        .set({
          earningBalance: () => 'earning_balance - :amount',
          settledBalance: () => 'settled_balance - :amount',
        })
        .where('id = :id', { id: wallet.id })
        .setParameter('amount', input.amount)
        .execute();
      return manager.save(
        MerchantPayout,
        manager.create(MerchantPayout, {
          merchantId: merchant.id,
          payoutAccountId: account.id,
          amount: String(input.amount),
          feeAmount: String(WITHDRAWAL_FEE),
          status: MerchantPayoutStatus.PENDING,
          destinationBankAccount: `${account.bankName} ${account.maskedAccountNumber} a.n. ${account.accountHolderName}`,
        }),
      );
    });

    const { data: wallet } = await this.merchantService.findWallet(userId);
    const data: WithdrawalResponseDto = {
      id: payout.id,
      status: payout.status,
      amount: Number(payout.amount),
      fee_amount: Number(payout.feeAmount),
      transfer_amount: Number(payout.amount) - Number(payout.feeAmount),
      destination: payout.destinationBankAccount,
      requested_at: payout.requestedAt,
      wallet,
    };
    return { data, responseMessage: 'Request withdrawal success' };
  }
}
