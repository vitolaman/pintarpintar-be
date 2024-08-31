import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'master_profile_picture' })
export class MasterProfilePicture extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'imagePath', nullable: false })
  imagePath: string;
}
