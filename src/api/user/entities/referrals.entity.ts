import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'referrals' })
export class Referrals extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id_ref_owner', nullable: false })
  userIdRefOwner: string;

  @ApiProperty()
  @Column({ name: 'user_id_ref_user', nullable: false })
  userIdRefUser: string;
}
