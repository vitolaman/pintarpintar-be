import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';

// The caller's own merchant. Publishing and editing vacancies need an active
// merchant; reading their own data only needs one that exists.
export async function findOwnMerchant(
  manager: EntityManager,
  userId: string,
  options: { requireActive?: boolean } = {},
): Promise<Merchant> {
  const merchant = await manager.findOne(Merchant, { where: { userId } });
  if (!merchant) throw new NotFoundException('Merchant not found');
  if (options.requireActive && merchant.status !== 'active') {
    throw new ForbiddenException('Merchant is not active');
  }
  return merchant;
}
