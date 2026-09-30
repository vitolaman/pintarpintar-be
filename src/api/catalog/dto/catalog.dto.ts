import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const catalogCardTypes = ['kelas', 'bootcamp', 'digital'] as const;
// `kelas-live` is an FE filter value with no class type behind it yet.
export const catalogTypeFilters = [...catalogCardTypes, 'kelas-live'] as const;
export const catalogLevels = ['Pemula', 'Menengah', 'Mahir'] as const;
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

  @ApiPropertyOptional({ example: 'desain', description: 'Category slug' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  category?: string;

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
}

export class CatalogMentorDto {
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

  @ApiProperty({ type: [CatalogMeetingDto], description: 'Bootcamps only' })
  meetings: CatalogMeetingDto[];
}

export class CatalogDigitalFileDto {
  @ApiProperty()
  id: string;

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
}
