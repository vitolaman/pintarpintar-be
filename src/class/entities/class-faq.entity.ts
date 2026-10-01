import { Column, Entity } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';

@Entity({ name: 'class_faqs' })
export class ClassFaq extends AuditedBaseEntity {
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @Column({ type: 'varchar', length: 300 })
  question: string;

  @Column({ type: 'text' })
  answer: string;
}
