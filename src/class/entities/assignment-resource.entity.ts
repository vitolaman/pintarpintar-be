import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// One ordered resource file of an assignment. Position 0 is mirrored in the
// assignment's resource_asset_id, which older readers still use.
@Entity({ name: 'assignment_resources' })
export class AssignmentResource extends BaseEntity {
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ type: 'smallint' })
  position: number;
}
