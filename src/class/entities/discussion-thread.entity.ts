import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { Comment } from './comment.entity';

export enum ThreadBadge {
  PENGUMUMAN = 'Pengumuman',
  TANYA_JAWAB = 'Tanya Jawab',
}

@Entity({ name: 'discussion_threads' })
export class DiscussionThread extends AuditedBaseEntity {
  @Column({ name: 'class_id' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.threads)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ type: 'varchar' })
  author_id: string;

  @Column({ type: 'varchar', nullable: true })
  author_role: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', default: ThreadBadge.TANYA_JAWAB })
  badge: ThreadBadge;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @OneToMany(() => Comment, (comment) => comment.thread)
  comments: Comment[];
}
