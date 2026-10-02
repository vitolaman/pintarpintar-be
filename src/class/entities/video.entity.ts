import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Chapter } from './chapter.entity';

export const videoSources = ['link', 'file'] as const;
export type VideoSource = (typeof videoSources)[number];

@Entity({ name: 'videos' })
export class Video extends AuditedBaseEntity {
  @Column({ name: 'chapter_id', type: 'uuid' })
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

  // 'link': youtubeUrl is the video. 'file': asset_id is an uploaded video.
  @Column({ type: 'varchar', length: 8, default: 'link' })
  source: VideoSource;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  asset_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  duration: string;

  @Column({ type: 'int', default: 0 })
  order: number;
}
