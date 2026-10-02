import { ApiProperty } from '@nestjs/swagger';

export class ItemCoverDto {
  @ApiProperty({ format: 'uuid' })
  asset_id: string;

  @ApiProperty({ nullable: true, type: String })
  url: string | null;
}
