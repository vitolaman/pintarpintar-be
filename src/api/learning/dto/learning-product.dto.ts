import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OwnedProductCategoryDto {
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
}

export class OwnedProductMerchantDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) slug: string | null;
}

export class OwnedProductAccessDto {
  @ApiProperty() granted_at: Date;
  @ApiPropertyOptional({ nullable: true }) expires_at: Date | null;
}

export class OwnedProductFileDto {
  @ApiProperty() name: string;
  @ApiProperty({ example: 'XLSX' }) format: string;
  @ApiProperty({ description: 'Bytes' }) size: number;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Signed link valid 10 minutes; older rows give their stored http(s) URL, else null',
  })
  download_url: string | null;
}

export class OwnedProductDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true }) cover_url: string | null;
  @ApiPropertyOptional({ type: OwnedProductCategoryDto, nullable: true })
  category: OwnedProductCategoryDto | null;
  @ApiProperty({ type: OwnedProductMerchantDto })
  merchant: OwnedProductMerchantDto;
  @ApiPropertyOptional({ nullable: true })
  post_purchase_instructions: string | null;
  @ApiProperty({ type: OwnedProductAccessDto }) access: OwnedProductAccessDto;
  @ApiPropertyOptional({ type: OwnedProductFileDto, nullable: true })
  file: OwnedProductFileDto | null;
}
