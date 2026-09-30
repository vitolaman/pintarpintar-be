import { PartialType } from '@nestjs/swagger';
import { CreatePayoutAccountDto } from './create-payout-account.dto';

export class UpdatePayoutAccountDto extends PartialType(
  CreatePayoutAccountDto,
) {}
