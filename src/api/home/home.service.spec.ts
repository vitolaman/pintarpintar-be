import { Repository } from 'typeorm';
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
              product_id: 'video-class-id',
              product_title: 'Video class title',
            },
          ]);
        }

        const subtype = sql.includes('INNER JOIN bootcamps')
          ? 'bootcamp'
          : sql.includes('INNER JOIN video_classes')
            ? 'video_class'
            : 'digital_product';

        return Promise.resolve([
          {
            id: `${subtype}-id`,
            title: `${subtype} title`,
            product_type: subtype,
            level: 'Pemula',
            price: '249000',
            currency: 'IDR',
            original_price: null,
            cover_asset_id: null,
            cover_object_key: null,
            categories: ['Desain'],
            rating: '4.8',
            review_count: '12',
            merchant_id: 'merchant-id',
            merchant_name: 'Pintar CAD',
            merchant_slug: 'pintar-cad',
            merchant_avatar_asset_id: null,
            merchant_avatar_object_key: null,
          },
        ]);
      }),
    };
    const service = new HomeService(products as Repository<Product>);

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
      data: [expect.objectContaining({ id: 'bootcamp-id', price: 249000 })],
    });
    await expect(service.getVideoClasses(10)).resolves.toEqual({
      responseMessage: 'Get video classes success',
      data: [expect.objectContaining({ id: 'video_class-id' })],
    });
    await expect(service.getDigitalProducts(10)).resolves.toEqual({
      responseMessage: 'Get digital products success',
      data: [expect.objectContaining({ id: 'digital_product-id' })],
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
        }),
      ],
    });

    expect(products.query).toHaveBeenCalledTimes(6);
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN bootcamps'),
      ['bootcamp', 10],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN video_classes'),
      ['video_class', 10],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN digital_files'),
      ['digital_product', 10],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM merchants merchant'),
      [10],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining("NULLIF(BTRIM(review.comment), '') IS NOT NULL"),
      [10],
    );
  });
});
