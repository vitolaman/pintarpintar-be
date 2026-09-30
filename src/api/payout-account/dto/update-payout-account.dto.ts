import { PartialType } from '@nestjs/swagger';
import { CreatePayoutAccountDto } from './create-payout-account.dto';

// Null is validated, so it is rejected for fields that cannot be cleared.
export class UpdatePayoutAccountDto extends PartialType(
  CreatePayoutAccountDto,
  { skipNullProperties: false },
) {}
