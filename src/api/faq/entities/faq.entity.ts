import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { FaqCategory } from './faq-category.entity';

@Entity({ name: 'faqs' })
export class Faq extends BaseEntity {
  @Column({ name: 'faq_category_id', type: 'uuid' })
  faqCategoryId: string;

  @ManyToOne(() => FaqCategory, (category) => category.faqs, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'faq_category_id' })
  category: FaqCategory;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
