import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @ApiProperty()
  @Column()
  name: string;

  // Unique among active users, ignoring case (uq_users_email_active), so a
  // deleted account's email can sign up again.
  @ApiProperty()
  @Column()
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

  // Raised to end every session issued before; tokens carry it as `tv`.
  @ApiHideProperty()
  @Exclude()
  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion: number;
}
