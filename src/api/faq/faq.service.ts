import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PublicFaqCategoryResponseDto,
  PublicFaqResponseDto,
} from './dto/public-faq-response.dto';
import { FaqCategory } from './entities/faq-category.entity';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(FaqCategory)
    private readonly faqCategories: Repository<FaqCategory>,
  ) {}

  async findPublic() {
    const categories = await this.faqCategories
      .createQueryBuilder('category')
      .innerJoinAndSelect(
        'category.faqs',
        'faq',
        'faq.deleted_at IS NULL AND faq.is_active = :active',
        { active: true },
      )
      .where('category.deleted_at IS NULL')
      .andWhere('category.is_active = :active', { active: true })
      .orderBy('category.display_order', 'ASC')
      .addOrderBy('category.id', 'ASC')
      .addOrderBy('faq.display_order', 'ASC')
      .addOrderBy('faq.id', 'ASC')
      .getMany();

    const data: PublicFaqResponseDto = {
      categories: categories.map((category) =>
        this.toPublicCategoryResponse(category),
      ),
      meta: {
        category_count: categories.length,
        question_count: categories.reduce(
          (total, category) => total + category.faqs.length,
          0,
        ),
      },
    };

    return {
      data,
      responseMessage: 'Get public FAQs success',
    };
  }

  private toPublicCategoryResponse(
    category: FaqCategory,
  ): PublicFaqCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      display_order: category.displayOrder,
      faqs: category.faqs.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        display_order: faq.displayOrder,
      })),
    };
  }
}
