import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { DiscussionThread } from './discussion-thread.entity';

@Entity({ name: 'comments' })
export class Comment extends AuditedBaseEntity {
  @Column({ name: 'thread_id' })
  thread_id: string;

  @ManyToOne(() => DiscussionThread, (thread) => thread.comments)
  @JoinColumn({ name: 'thread_id' })
  thread: DiscussionThread;

  @Column({ type: 'varchar' })
  author_id: string;

  @Column({ type: 'varchar', nullable: true })
  author_role: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
