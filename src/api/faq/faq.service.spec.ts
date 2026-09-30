import { Repository } from 'typeorm';
import { FaqCategory } from './entities/faq-category.entity';
import { FaqService } from './faq.service';

describe('FaqService', () => {
  const categories: FaqCategory[] = [
    {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'Akun & Profil',
      displayOrder: 1,
      isActive: true,
      faqs: [
        {
          id: '30000000-0000-4000-8000-000000000002',
          question: 'Bagaimana cara mengubah password?',
          answer: 'Buka halaman pengaturan akun.',
          displayOrder: 1,
          isActive: true,
        },
        {
          id: '30000000-0000-4000-8000-000000000003',
          question: 'Bagaimana cara mendaftar?',
          answer: 'Gunakan halaman pendaftaran.',
          displayOrder: 2,
          isActive: true,
        },
      ],
    } as FaqCategory,
  ];

  it('returns only the grouped public projection and visible totals', async () => {
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(categories),
    };
    const faqCategories = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<FaqCategory>;
    const service = new FaqService(faqCategories);

    await expect(service.findPublic()).resolves.toEqual({
      data: {
        categories: [
          {
            id: '20000000-0000-4000-8000-000000000001',
            name: 'Akun & Profil',
            display_order: 1,
            faqs: [
              {
                id: '30000000-0000-4000-8000-000000000002',
                question: 'Bagaimana cara mengubah password?',
                answer: 'Buka halaman pengaturan akun.',
                display_order: 1,
              },
              {
                id: '30000000-0000-4000-8000-000000000003',
                question: 'Bagaimana cara mendaftar?',
                answer: 'Gunakan halaman pendaftaran.',
                display_order: 2,
              },
            ],
          },
        ],
        meta: { category_count: 1, question_count: 2 },
      },
      responseMessage: 'Get public FAQs success',
    });

    expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
      'category.faqs',
      'faq',
      'faq.deleted_at IS NULL AND faq.is_active = :active',
      { active: true },
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'category.deleted_at IS NULL',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'category.is_active = :active',
      { active: true },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'category.display_order',
      'ASC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(
      1,
      'category.id',
      'ASC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(
      2,
      'faq.display_order',
      'ASC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(3, 'faq.id', 'ASC');
  });

  it('returns an empty public response when no active content exists', async () => {
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const faqCategories = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<FaqCategory>;
    const service = new FaqService(faqCategories);

    await expect(service.findPublic()).resolves.toEqual({
      data: {
        categories: [],
        meta: { category_count: 0, question_count: 0 },
      },
      responseMessage: 'Get public FAQs success',
    });
  });
});
