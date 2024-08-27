import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'predictions' })
export class Predictions extends BaseEntity {
  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ApiProperty()
  @Column({ name: 'sport', nullable: false })
  sport: string;

  @ApiProperty()
  @Column({ name: 'category_id', nullable: false })
  categoryId: string;

  @ApiProperty()
  @Column({ name: 'match_id', nullable: false })
  matchId: string;

  @ApiProperty()
  @Column({ name: 'match_status', nullable: false, default: 0 })
  matchStatus: number; // 0: pending; 1: win; -1: lose; -2: match cancelled

  @ApiProperty()
  @Column({ name: 'prediction', nullable: false })
  prediction: number; // 1: local team win; 2: visitor team win; 3: draw

  @ApiProperty()
  @Column({ name: 'local_team_id', nullable: false })
  localTeamId: string;

  @ApiProperty()
  @Column({ name: 'visitor_team_id', nullable: false })
  visitorTeamId: string;

  @Column('simple-json', { name: 'partner_data_json' })
  partnerDataJson: any | null;
}
