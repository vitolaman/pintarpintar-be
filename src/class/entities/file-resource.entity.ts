import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Chapter } from './chapter.entity';

export enum ResourceType {
  VIDEO = 'video',
  PDF = 'pdf',
  ZIP = 'zip',
  LINK = 'link',
  IMAGE = 'image',
}

@Entity({ name: 'file_resources' })
export class FileResource extends AuditedBaseEntity {
  @Column({ name: 'chapter_id' })
  chapter_id: string;

  @ManyToOne(() => Chapter, (chapter) => chapter.resources)
  @JoinColumn({ name: 'chapter_id' })
  chapter: Chapter;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: ResourceType.PDF })
  type: ResourceType;

  @Column({ type: 'varchar', nullable: true })
  url: string;

  @Column({ type: 'varchar', nullable: true })
  size: string;
}
