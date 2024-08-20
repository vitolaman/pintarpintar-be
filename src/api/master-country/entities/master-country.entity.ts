import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class MasterCountry {
  constructor(partial: Partial<MasterCountry>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ example: '98' })
  @PrimaryGeneratedColumn({ name: 'country_id' })
  public countryId!: number;

  @ApiProperty({ example: 'Indonesia' })
  @Column({ type: 'varchar', name: 'country_name' })
  public countryName!: string;
}

export { MasterCountry };
