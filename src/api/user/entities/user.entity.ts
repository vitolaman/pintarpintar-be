import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Column({ unique: true })
  email: string;

  @ApiProperty()
  @Column({ name: 'is_mentor', default: false })
  isMentor: boolean;

  @ApiProperty()
  @Column({ name: 'is_merchant', default: false })
  isMerchant: boolean;

  @ApiHideProperty()
  @Exclude()
  @Column({ name: 'password_hash' })
  passwordHash: string;

  @ApiHideProperty()
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;
}
