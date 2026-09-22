import { ApiProperty } from '@nestjs/swagger';
import { Column } from 'typeorm';
import { BaseEntity } from './base-entity';

export abstract class AuditedBaseEntity extends BaseEntity {
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  created_by?: string;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  updated_by?: string;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  deleted_by?: string;
}
