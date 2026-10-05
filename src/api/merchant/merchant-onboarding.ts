import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn } from 'class-validator';
import { contentItemTypes } from '~/common/catalog/catalog-item';
import { canonicalValue } from '~/common/decorator/input.decorator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';

// Answers of the registration form (Lengkapi Profil Merchant).

/** Jenis Merchant: Individu / Kreator, Lembaga Pendidikan, Perusahaan / Brand. */
export const merchantBusinessTypes = [
  'individual',
  'institution',
  'company',
] as const;
export type MerchantBusinessType = (typeof merchantBusinessTypes)[number];

/** Produk yang Ingin Dijual: Kelas Video, Live Bootcamp, Produk Digital. */
export const merchantProductTypes = contentItemTypes;
export type MerchantProductType = (typeof merchantProductTypes)[number];

const PRODUCT_TYPES_DESCRIPTION =
  'What the merchant intends to sell, one to three of kelas (Kelas Video), bootcamp (Live Bootcamp) and digital (Produk Digital); repeated values collapse and the list is returned in this order';

/**
 * Collapses repeated product types and puts them in the fixed order, so one
 * choice always reads back the same. Unknown values are kept for the
 * validator to reject.
 */
function orderedProductTypes(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const canonical = value.map((item) =>
    canonicalValue(merchantProductTypes, item),
  );
  const known = merchantProductTypes.filter((type) => canonical.includes(type));
  const unknown = canonical.filter(
    (item) => !(merchantProductTypes as readonly unknown[]).includes(item),
  );
  return [...known, ...unknown];
}

export const ProductTypesInput = ({ optional = false } = {}) =>
  applyDecorators(
    (optional ? ApiPropertyOptional : ApiProperty)({
      type: [String],
      enum: merchantProductTypes,
      minItems: 1,
      maxItems: merchantProductTypes.length,
      example: ['kelas', 'digital'],
      description: PRODUCT_TYPES_DESCRIPTION,
    }),
    Transform(({ value }) => orderedProductTypes(value)),
    ...(optional ? [OptionalNotNull()] : []),
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(merchantProductTypes.length),
    IsIn(merchantProductTypes, { each: true }),
  );
