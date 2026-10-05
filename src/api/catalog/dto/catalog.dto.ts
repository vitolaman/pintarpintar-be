import { ItemCoverDto } from '../../item-cover/dto/item-cover.dto';
import {
  classSkillCategories,
  learningLevels,
} from '~/common/catalog/class-details';
import {
  MEETING_DURATION_DESCRIPTION,
  MEETING_STATUS_DESCRIPTION,
  MeetingMentorDto,
} from '~/class/dto/class-response.dto';
import { ClassFaqResponseDto } from '~/class/dto/class-faq.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  canonicalValue,
  EnumInput,
  QueryFilter,
} from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export const catalogCardTypes = ['kelas', 'bootcamp', 'digital'] as const;
// `kelas-live` is the frontend's "Kelas Live" filter, a kind not offered yet
// (PM item 21); it is accepted and matches no items, so the filter shows an
// empty list instead of failing.
export const catalogTypeFilters = [...catalogCardTypes, 'kelas-live'] as const;
export const catalogLevels = learningLevels;
export const catalogSortFields = [
  'created_at',
  'popularity',
  'price',
  'rating',
  'title',
] as const;
export const sortOrders = ['asc', 'desc'] as const;

export type CatalogCardType = (typeof catalogCardTypes)[number];
export type CatalogSortField = (typeof catalogSortFields)[number];
export type SortOrder = (typeof sortOrders)[number];
export type CatalogSort = { by: CatalogSortField; order: SortOrder };

// Each field has a natural direction, so "Termurah" or "Nama (A-Z)" need only
// sort_by: newest, most popular and best rated first; cheapest and A-Z first.
export const DEFAULT_SORT_ORDER: Record<CatalogSortField, SortOrder> = {
  created_at: 'desc',
  popularity: 'desc',
  price: 'asc',
  rating: 'desc',
  title: 'asc',
};

export const SORT_FIELD_DESCRIPTION =
  'created_at (newest), popularity (students), price, rating, title';
export const SORT_ORDER_DESCRIPTION =
  'Defaults per field: created_at, popularity and rating desc; price and title asc';

export function catalogSort(
  by: CatalogSortField = 'created_at',
  order?: SortOrder,
): CatalogSort {
  return { by, order: order ?? DEFAULT_SORT_ORDER[by] };
}

// Frontend file-type filters and the stored digital_files.file_format values
// each one matches (compared in lower case).
export const FILE_FORMAT_ALIASES: Record<string, string[]> = {
  pdf: ['pdf'],
  dwg: ['dwg'],
  excel: ['excel', 'xls', 'xlsx'],
  powerpoint: ['powerpoint', 'ppt', 'pptx'],
  word: ['word', 'doc', 'docx'],
  zip: ['zip'],
};

function expandFileFormats(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const formats = value
    .split(',')
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((format) => FILE_FORMAT_ALIASES[format] ?? [format]);
  return formats.length > 0 ? [...new Set(formats)] : undefined;
}

function parseTypeFilters(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const types = value
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean)
    .map((type) => canonicalValue(catalogTypeFilters, type));
  return types.length > 0 ? types : undefined;
}

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: `Comma-separated, ignoring case: ${catalogTypeFilters.join(', ')} (kelas-live matches no items yet). A blank value means every type.`,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => parseTypeFilters(value))
  @ArrayMaxSize(4)
  @IsIn(catalogTypeFilters, { each: true })
  type?: string[];

  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Matches, ignoring case, part of the title, merchant store name, class Bidang or digital category name, or a whole file format. A blank value means no search.',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @EnumInput(catalogLevels, { presence: 'filter' })
  level?: string;

  @ApiPropertyOptional({
    example: 'template-canva',
    description:
      'Digital category slug, or a digital category name or class Bidang ignoring case, e.g. template-canva, Template Canva or Sipil. A digital category includes its sub-categories, so desain-grafis also returns Photoshop products. A blank value means every category.',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    example: 'photoshop',
    description:
      'Digital sub-category slug, or its name ignoring case, e.g. photoshop or Video Effect; returns only digital products in it or below it. With category, both must match, so category=desain-grafis&sub=video-effect returns nothing. Classes never match. A blank value means no sub-category filter.',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sub?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Only this merchant's items; a blank value means every merchant",
  })
  @QueryFilter()
  @IsOptional()
  @IsUUID()
  merchant_id?: string;

  @ApiPropertyOptional({
    description: `Comma-separated, ignoring case: ${Object.keys(FILE_FORMAT_ALIASES).join(', ')}; excel, powerpoint and word include their file extensions, and other values match the stored format. Classes have no files, so they never match.`,
    type: String,
    example: 'pdf,dwg',
  })
  @IsOptional()
  @Transform(({ value }) => expandFileFormats(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  file_format?: string[];

  @EnumInput(catalogSortFields, {
    presence: 'filter',
    default: 'created_at',
    description: SORT_FIELD_DESCRIPTION,
  })
  sort_by: CatalogSortField = 'created_at';

  @EnumInput(sortOrders, {
    presence: 'filter',
    description: SORT_ORDER_DESCRIPTION,
  })
  sort_order?: SortOrder;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class CatalogMerchantDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  slug: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Avatar URL; null without an avatar',
  })
  avatar_url: string | null;
}

export class CatalogCardMentorDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Mentor id; null for a product mentor without a mentor account',
  })
  id: string | null;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  avatar_url: string | null;
}

export class CatalogCardDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: catalogCardTypes })
  type: CatalogCardType;

  @ApiProperty()
  title: string;

  @ApiProperty({
    nullable: true,
    description:
      'Classes: their Bidang; digital products: their first category name in alphabetical order. Null when unset.',
  })
  category: string | null;

  @ApiProperty({
    nullable: true,
    enum: classSkillCategories,
    description:
      'Classes: their Kategori Skill (null for classes created before the field); digital products: null',
  })
  skill_category: string | null;

  @ApiProperty({
    nullable: true,
    enum: catalogLevels,
    description: 'Null when unset',
  })
  level: string | null;

  @ApiProperty({ example: 299000, description: 'Current selling price' })
  price: number;

  @ApiProperty({ example: 350000, description: 'List (strikethrough) price' })
  original_price: number;

  @ApiProperty({
    nullable: true,
    example: 15,
    description: 'Null without a discount',
  })
  discount_percent: number | null;

  @ApiProperty({ example: 4.8 })
  rating: number;

  @ApiProperty({ example: 12 })
  review_count: number;

  @ApiProperty({
    example: 234,
    description: 'Enrolled learners or product owners',
  })
  students_count: number;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ type: CatalogMerchantDto })
  merchant: CatalogMerchantDto;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Image URL; null without ASSET_PUBLIC_BASE_URL or a cover',
  })
  image_url: string | null;

  @ApiPropertyOptional({
    type: () => CatalogCardMentorDto,
    nullable: true,
    description: 'First assigned mentor, or null',
  })
  mentor: CatalogCardMentorDto | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'DWG, PDF',
    description:
      "The product's distinct file formats in upper case; null for classes and products without files",
  })
  file_format: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 15728640,
    description:
      "Total bytes of the product's files; null for classes and products without files",
  })
  file_size: number | null;
}

export class CatalogItemCardDto extends CatalogCardDto {
  @ApiProperty({
    description:
      "True when the item is in the signed-in caller's wishlist; false without a token",
  })
  in_wishlist: boolean;
}

export class CatalogMentorDto {
  @ApiProperty({ description: 'Mentor id used by the profile page' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  headline: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Avatar URL; null without an avatar',
  })
  avatar_url: string | null;

  @ApiProperty({ example: 'Lead Mentor' })
  role: string;
}

export class CatalogVideoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  duration: string | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Date added' })
  created_at: Date;
}

export class CatalogFileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'pdf' })
  type: string;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 2621440,
    description: 'Bytes; null when unknown',
  })
  size: number | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Date added' })
  created_at: Date;
}

export class CatalogChapterDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: [CatalogVideoDto] })
  videos: CatalogVideoDto[];

  @ApiProperty({ type: [CatalogFileDto] })
  files: CatalogFileDto[];
}

export class CatalogMeetingDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, example: '2026-10-02' })
  date: string | null;

  @ApiProperty({ nullable: true, example: '19:00', description: 'WIB' })
  time: string | null;

  @ApiProperty({
    enum: ['upcoming', 'completed'],
    description: MEETING_STATUS_DESCRIPTION,
  })
  status: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 90,
    description: MEETING_DURATION_DESCRIPTION,
  })
  duration_minutes: number | null;

  @ApiPropertyOptional({ type: MeetingMentorDto, nullable: true })
  mentor: MeetingMentorDto | null;
}

export class CatalogClassDetailDto extends CatalogItemCardDto {
  @ApiProperty({
    type: [ItemCoverDto],
    description: 'Ordered covers; the first is the card image',
  })
  covers: ItemCoverDto[];

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true, example: '8 minggu' })
  duration: string | null;

  @ApiProperty({
    type: [String],
    description: 'The prerequisites text split into lines',
  })
  requirements: string[];

  @ApiProperty({ nullable: true, description: 'Prasyarat' })
  prerequisites: string | null;

  @ApiProperty({ type: [String], description: 'Hasil Pembelajaran' })
  learning_outcomes: string[];

  @ApiProperty({ type: [CatalogMentorDto] })
  mentors: CatalogMentorDto[];

  @ApiProperty({ type: [CatalogChapterDto] })
  chapters: CatalogChapterDto[];

  @ApiProperty({
    description: 'True when the signed-in visitor is enrolled',
  })
  is_owned: boolean;

  @ApiProperty({
    description:
      "True when the item is in the signed-in caller's cart; false without a token",
  })
  in_cart: boolean;

  @ApiProperty({
    description:
      'True when the signed-in caller has a live review of this item; false without a token',
  })
  has_reviewed: boolean;

  @ApiProperty({ type: [CatalogMeetingDto], description: 'Bootcamps only' })
  meetings: CatalogMeetingDto[];

  @ApiProperty({
    type: [ClassFaqResponseDto],
    description: 'Class FAQ, in order',
  })
  faqs: ClassFaqResponseDto[];
}

export class CatalogDigitalFileDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'template-rab.xlsx' })
  name: string;

  @ApiProperty({ example: 'xlsx' })
  format: string;

  @ApiProperty({ example: 2048000, description: 'Bytes' })
  size: number;
}

export class CatalogDigitalDetailDto extends CatalogItemCardDto {
  @ApiProperty({
    type: [ItemCoverDto],
    description: 'Ordered covers; the first is the card image',
  })
  covers: ItemCoverDto[];

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: [CatalogDigitalFileDto] })
  files: CatalogDigitalFileDto[];

  @ApiProperty({
    description: 'True when the signed-in visitor has unexpired access',
  })
  is_owned: boolean;

  @ApiProperty({
    description:
      "True when the item is in the signed-in caller's cart; false without a token",
  })
  in_cart: boolean;

  @ApiProperty({
    description:
      'True when the signed-in caller has a live review of this item; false without a token',
  })
  has_reviewed: boolean;
}

export class CategoryNodeDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Desain Grafis' }) name: string;
  @ApiProperty({ example: 'desain-grafis' }) slug: string;
  @ApiProperty({ type: () => [CategoryNodeDto] }) children: CategoryNodeDto[];
}
