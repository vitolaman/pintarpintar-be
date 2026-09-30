import { learningLevels } from '~/common/catalog/class-details';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const catalogCardTypes = ['kelas', 'bootcamp', 'digital'] as const;
// `kelas-live` is an FE filter value with no class type behind it yet.
export const catalogTypeFilters = [...catalogCardTypes, 'kelas-live'] as const;
export const catalogLevels = learningLevels;
export const catalogSorts = [
  'terbaru',
  'terlama',
  'terpopuler',
  'terkurang-populer',
  'termurah',
  'termahal',
  'rating',
  'title',
] as const;

export type CatalogCardType = (typeof catalogCardTypes)[number];
export type CatalogSort = (typeof catalogSorts)[number];

const toNumber = ({ value }: { value: unknown }) => Number(value);

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

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: `Comma-separated: ${catalogTypeFilters.join(', ')}`,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((type) => type.trim())
          .filter(Boolean)
      : value,
  )
  @ArrayMaxSize(4)
  @IsIn(catalogTypeFilters, { each: true })
  type?: string[];

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: catalogLevels })
  @IsOptional()
  @IsIn(catalogLevels)
  level?: string;

  @ApiPropertyOptional({
    example: 'template-canva',
    description: 'Category slug or name (ignoring case), e.g. Template Canva',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Only this merchant's items",
  })
  @IsOptional()
  @IsUUID()
  merchant_id?: string;

  @ApiPropertyOptional({
    description: `Comma-separated digital file types: ${Object.keys(FILE_FORMAT_ALIASES).join(', ')}`,
    type: String,
    example: 'pdf,dwg',
  })
  @IsOptional()
  @Transform(({ value }) => expandFileFormats(value))
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  file_format?: string[];

  @ApiPropertyOptional({ enum: catalogSorts, default: 'terbaru' })
  @IsOptional()
  @IsIn(catalogSorts)
  sort: CatalogSort = 'terbaru';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class CatalogMerchantDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  slug: string | null;

  @ApiProperty({ nullable: true })
  avatar_object_key: string | null;
}

export class CatalogCardMentorDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Mentor id; null for a product mentor without a mentor account',
  })
  id: string | null;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
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
    description: 'Cover object key; null for classes',
  })
  image: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Category name; null for classes',
  })
  category: string | null;

  @ApiProperty({
    nullable: true,
    enum: catalogLevels,
    description: 'Null for classes',
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
    description: 'Image URL; null without ASSET_PUBLIC_BASE_URL or a cover',
  })
  image_url: string | null;

  @ApiPropertyOptional({
    type: () => CatalogCardMentorDto,
    description: 'First assigned mentor, or null',
  })
  mentor: CatalogCardMentorDto | null;

  @ApiPropertyOptional({ example: 'PDF', description: 'Digital products only' })
  file_format: string | null;

  @ApiPropertyOptional({
    example: 15728640,
    description: 'Bytes; digital products only',
  })
  file_size: number | null;
}

export class CatalogMentorDto {
  @ApiProperty({ description: 'Mentor id used by the profile page' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  headline: string | null;

  @ApiProperty({ nullable: true })
  avatar_object_key: string | null;

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

  @ApiProperty({ nullable: true, example: '2.5 MB' })
  size: string | null;

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

  @ApiProperty({ example: 'upcoming' })
  status: string;
}

export class CatalogClassDetailDto extends CatalogCardDto {
  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true, description: 'Not modelled yet' })
  duration: string | null;

  @ApiProperty({ type: [String], description: 'Not modelled yet' })
  requirements: string[];

  @ApiProperty({ type: [CatalogMentorDto] })
  mentors: CatalogMentorDto[];

  @ApiProperty({ type: [CatalogChapterDto] })
  chapters: CatalogChapterDto[];

  @ApiProperty({
    description: 'True when the signed-in visitor is enrolled',
  })
  is_owned: boolean;

  @ApiProperty({ type: [CatalogMeetingDto], description: 'Bootcamps only' })
  meetings: CatalogMeetingDto[];
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

export class CatalogDigitalDetailDto extends CatalogCardDto {
  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ type: [CatalogDigitalFileDto] })
  files: CatalogDigitalFileDto[];

  @ApiProperty({
    description: 'True when the signed-in visitor has access',
  })
  is_owned: boolean;
}

export class CategoryNodeDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Desain Grafis' }) name: string;
  @ApiProperty({ example: 'desain-grafis' }) slug: string;
  @ApiProperty({ type: () => [CategoryNodeDto] }) children: CategoryNodeDto[];
}
