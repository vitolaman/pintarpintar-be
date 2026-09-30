import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { productStatuses } from './digital-product-request.dto';

export class ProductCategoryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
}

export class ProductFileDto {
  @ApiPropertyOptional({ nullable: true }) asset_id: string | null;
  @ApiProperty({ example: 'report.xlsx' }) name: string;
  @ApiProperty({ example: 'XLSX' }) format: string;
  @ApiProperty({ description: 'Bytes' }) size: number;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed download link (detail only), valid 10 minutes',
  })
  download_url: string | null;
}

export class DigitalProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ type: ProductCategoryDto, nullable: true })
  category: ProductCategoryDto | null;
  @ApiPropertyOptional({ nullable: true }) cover_asset_id: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Null when no public asset base URL is configured',
  })
  cover_url: string | null;
  @ApiProperty() original_price: number;
  @ApiProperty() discount_price: number;
  @ApiProperty({ description: 'Current selling price' }) price: number;
  @ApiProperty({ enum: productStatuses }) status: string;
  @ApiProperty() is_published: boolean;
  @ApiPropertyOptional({ nullable: true }) published_at: Date | null;
  @ApiPropertyOptional({ type: ProductFileDto, nullable: true })
  file: ProductFileDto | null;
  @ApiProperty({ description: 'Learners with access' }) downloads: number;
  @ApiProperty() rating: number;
  @ApiProperty() review_count: number;
  @ApiProperty({ description: 'Net income from paid order items' })
  revenue: number;
  @ApiPropertyOptional({ nullable: true })
  post_purchase_instructions: string | null;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
