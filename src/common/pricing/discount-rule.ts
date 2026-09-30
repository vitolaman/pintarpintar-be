import { BadRequestException } from '@nestjs/common';

// The list price is the strikethrough price and a discount above 0 is the
// selling price, so a set discount may not exceed the list price.
export function assertDiscountWithinPrice(
  listPrice: number | null | undefined,
  discountPrice: number | null | undefined,
  fields: { list: string; discount: string },
): void {
  if (discountPrice && discountPrice > (listPrice ?? 0)) {
    throw new BadRequestException(
      `${fields.discount} must not exceed ${fields.list}`,
    );
  }
}
