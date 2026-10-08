import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsOptional } from 'class-validator';
import { merchantCategoryLabels } from '~/common/constants/merchant-category';
import {
  ClearableText,
  EnumInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import {
  MerchantBusinessType,
  merchantBusinessTypes,
  MerchantProductType,
  ProductTypesInput,
} from '../merchant-onboarding';

export class RegisterMerchantDto {
  @RequiredText({ max: 160, example: 'Akademi Teknik Nusantara' })
  store_name: string;

  @RequiredText({
    max: 2_000,
    example: 'Kelas dan bootcamp teknik untuk profesional.',
  })
  store_description: string;

  @ApiProperty({
    enum: [true],
    description:
      'Agreement to the Syarat dan Ketentuan; must be true. Stored as terms_accepted_at.',
  })
  @IsBoolean()
  @Equals(true, { message: 'terms_accepted must be true' })
  terms_accepted: boolean;

  @EnumInput(merchantBusinessTypes, {
    example: 'individual',
    description:
      'Jenis Merchant: individual (Individu / Kreator), institution (Lembaga Pendidikan) or company (Perusahaan / Brand)',
  })
  business_type: MerchantBusinessType;

  @EnumInput(merchantCategoryLabels, {
    presence: 'nullable',
    example: 'Teknik & Arsitektur',
    description:
      'Bidang Utama as a merchant category: Teknik & Arsitektur (Teknik & Engineering), Pemrograman & IT (Teknologi & Pemrograman), Desain & Kreatif, Bisnis & Manajemen; null or omitted for Lainnya (no category)',
  })
  category_label?: string | null;

  @RequiredText({
    max: 120,
    example: 'Jakarta Selatan',
    description: 'Kota Operasional',
  })
  city: string;

  @RequiredText({
    max: 32,
    example: '0812 3456 7890',
    description:
      'Nomor WhatsApp Bisnis, the public store contact (shown on the storefront and editable in the profile settings)',
  })
  public_phone: string;

  @ProductTypesInput()
  product_types: MerchantProductType[];

  @ApiPropertyOptional({
    nullable: true,
    example: true,
    description: 'Pernah jualan kelas atau produk digital? (Sudah = true)',
  })
  @IsOptional()
  @IsBoolean()
  has_sold_before?: boolean | null;

  @ClearableText({
    max: 2_000,
    description: 'Ide produk atau kelas (asked when not sold before)',
  })
  product_idea?: string | null;

  @ClearableText({
    max: 100,
    example: '1-5-juta',
    description: 'Rata-rata nominal transaksi per bulan, as the form sends it',
  })
  monthly_revenue_range?: string | null;

  @ClearableText({
    max: 100,
    example: '51-100',
    description: 'Rata-rata jumlah transaksi per bulan, as the form sends it',
  })
  monthly_transaction_range?: string | null;

  @ClearableText({
    max: 2_000,
    description: 'Produk atau kelas yang pernah dijual',
  })
  sold_products?: string | null;

  @ApiPropertyOptional({ nullable: true, default: false, example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  need_change_password?: boolean | null;
}
