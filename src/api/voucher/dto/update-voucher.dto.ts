import { PartialType } from '@nestjs/swagger';
import { CreateVoucherDto } from './create-voucher.dto';

// Null is validated, so it is rejected for fields that cannot be cleared.
export class UpdateVoucherDto extends PartialType(CreateVoucherDto, {
  skipNullProperties: false,
}) {}
