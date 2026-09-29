import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { Faq } from './faq.entity';

@Entity({ name: 'faq_categories' })
export class FaqCategory extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Faq, (faq) => faq.category)
  faqs: Faq[];
}
