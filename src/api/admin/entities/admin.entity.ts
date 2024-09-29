import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'admins' })
export class Admin extends BaseEntity {
  @ApiProperty()
  @Column({ nullable: true })
  name: string;

  @ApiProperty()
  @Column({ nullable: true })
  username: string;

  @ApiProperty()
  @Column({ nullable: false })
  email: string;

  @ApiHideProperty()
  @Exclude()
  @Column({ nullable: false })
  password: string;
}
