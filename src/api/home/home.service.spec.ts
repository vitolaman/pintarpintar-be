import { Repository } from 'typeorm';
import { Product } from '../profile/entities/product.entity';
import { HomeService } from './home.service';

describe('HomeService', () => {
  it('builds all Beranda collections from bounded database projections', async () => {
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

    await expect(service.getHome(8)).resolves.toEqual({
      responseMessage: 'Get home success',
      data: expect.objectContaining({
        statistics: {
          active_students: 10,
          learning_products: 4,
          digital_products: 2,
          platform_rating: 4.8,
        },
        featured_bootcamps: [
          expect.objectContaining({
            id: 'bootcamp-id',
            price: 249000,
            rating: 4.8,
          }),
        ],
        featured_video_classes: [
          expect.objectContaining({ id: 'video_class-id' }),
        ],
        featured_digital_products: [
          expect.objectContaining({ id: 'digital_product-id' }),
        ],
        latest_merchants: [
          expect.objectContaining({
            id: 'merchant-id',
            best_product_rating: 4.9,
          }),
        ],
      }),
    });

    expect(products.query).toHaveBeenCalledTimes(5);
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN bootcamps'),
      [8],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN video_classes'),
      [8],
    );
    expect(products.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN digital_files'),
      [8],
    );
  });
});
