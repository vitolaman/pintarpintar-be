import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Chapter } from './chapter.entity';

@Entity({ name: 'videos' })
export class Video extends AuditedBaseEntity {
  @Column({ name: 'chapter_id' })
  chapter_id: string;

  @ManyToOne(() => Chapter, (chapter) => chapter.videos)
  @JoinColumn({ name: 'chapter_id' })
  chapter: Chapter;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  youtubeUrl: string;

  @Column({ type: 'varchar', nullable: true })
  duration: string;
}
