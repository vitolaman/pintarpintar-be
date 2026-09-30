import { Repository } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import { Product } from '../profile/entities/product.entity';
import { HomeService } from './home.service';

describe('HomeService', () => {
  it('builds independent bounded Beranda component projections', async () => {
    const products: jest.Mocked<Partial<Repository<Product>>> = {
      query: jest.fn((sql: string) => {
        if (sql.includes('AS active_students')) {
          return Promise.resolve([
            {
              active_students: '10',
              learning_products: '4',
              digital_products: '2',
              platform_rating: '4.8',
            },
          ]);
        }

        if (sql.includes('FROM merchants merchant')) {
          return Promise.resolve([
            {
              id: 'merchant-id',
              name: 'Pintar CAD',
              slug: 'pintar-cad',
              avatar_asset_id: null,
              avatar_object_key: null,
              best_product_title: 'AutoCAD dari Nol',
              best_product_cover_asset_id: null,
              best_product_cover_object_key: null,
              best_product_rating: '4.9',
            },
          ]);
        }

        if (sql.includes('FROM reviews review')) {
          return Promise.resolve([
            {
              id: 'review-id',
              rating: '5',
              comment: 'Materinya jelas dan mudah diikuti.',
              created_at: new Date('2026-09-01T00:00:00.000Z'),
              user_name: 'Alya Pratama',
              user_avatar_asset_id: null,
              user_avatar_object_key: null,
              class_id: 'class-id',
              class_title: 'Revit Architecture untuk Pemula',
            },
          ]);
        }

        return Promise.reject(new Error(`Unexpected query: ${sql}`));
      }),
    };
    const catalogService = {
      findCards: jest.fn(({ types }: { types: string[] }) =>
        Promise.resolve([{ id: `${types[0]}-id`, type: types[0] }]),
      ),
    };
    const service = new HomeService(
      products as Repository<Product>,
      catalogService as unknown as CatalogService,
    );

    await expect(service.getStatistics()).resolves.toEqual({
      responseMessage: 'Get home statistics success',
      data: {
        active_students: 10,
        learning_products: 4,
        digital_products: 2,
        platform_rating: 4.8,
      },
    });
    await expect(service.getBootcamps(10)).resolves.toEqual({
      responseMessage: 'Get bootcamps success',
      data: [{ id: 'bootcamp-id', type: 'bootcamp' }],
    });
    await expect(service.getVideoClasses(10)).resolves.toEqual({
      responseMessage: 'Get video classes success',
      data: [{ id: 'kelas-id', type: 'kelas' }],
    });
    await expect(service.getDigitalProducts(10)).resolves.toEqual({
      responseMessage: 'Get digital products success',
      data: [{ id: 'digital-id', type: 'digital' }],
    });
    await expect(service.getMerchants(10)).resolves.toEqual({
      responseMessage: 'Get merchants success',
      data: [
        expect.objectContaining({
          id: 'merchant-id',
          best_product_rating: 4.9,
        }),
      ],
    });
    await expect(service.getTestimonials(10)).resolves.toEqual({
      responseMessage: 'Get testimonials success',
      data: [
        expect.objectContaining({
          id: 'review-id',
          rating: 5,
          user_name: 'Alya Pratama',
          class_id: 'class-id',
          class_title: 'Revit Architecture untuk Pemula',
        }),
      ],
    });

    expect(products.query).toHaveBeenCalledTimes(3);
    expect(catalogService.findCards.mock.calls).toEqual([
      [{ types: ['bootcamp'] }, 'terbaru', 10],
      [{ types: ['kelas'] }, 'terbaru', 10],
      [{ types: ['digital'] }, 'terbaru', 10],
    ]);
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM merchants merchant'),
      [10],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining("NULLIF(BTRIM(review.comment), '') IS NOT NULL"),
      [10],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('ON class.id = review.class_id'),
      [10],
    );
  });
});
