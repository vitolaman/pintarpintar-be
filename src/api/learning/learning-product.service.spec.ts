import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LearningProductService } from './learning-product.service';

describe('LearningProductService', () => {
  const row = {
    id: 'product-id',
    title: 'Template RAB',
    description: null,
    cover_object_key: null,
    post_purchase_instructions: 'Unduh di Portal Saya',
    merchant_id: 'merchant-id',
    merchant_name: 'Akademi',
    merchant_slug: 'akademi',
    category_name: 'Excel',
    category_slug: 'excel',
    file_format: 'xlsx',
    file_size: 2048,
    file_url: 'uploads/1-rab.xlsx',
    file_object_key: 'uploads/1-rab.xlsx',
    file_name: 'rab.xlsx',
    granted_at: new Date(),
    expires_at: null,
  };
  let query: jest.Mock;
  let service: LearningProductService;

  beforeEach(() => {
    query = jest.fn();
    service = new LearningProductService(
      { query } as never,
      new ConfigService({
        AWS_S3_BUCKET_NAME: 'bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
      }),
    );
  });

  it('checks active, unexpired access without filtering deleted products', async () => {
    query.mockResolvedValue([row]);

    const { data } = await service.findProduct('user-id', 'product-id');

    const [sql] = query.mock.calls[0];
    expect(sql).toContain(
      'access.expires_at IS NULL OR access.expires_at > now()',
    );
    expect(sql).not.toContain('product.deleted_at IS NULL');
    expect(data.file).toMatchObject({
      name: 'rab.xlsx',
      format: 'XLSX',
      size: 2048,
    });
    expect(data.file.download_url).toContain('X-Amz-Signature');
  });

  it('keeps an older public file URL', async () => {
    query.mockResolvedValue([
      {
        ...row,
        file_object_key: null,
        file_name: null,
        file_url: 'https://files.example/sap2000.pdf',
      },
    ]);

    const { data } = await service.findProduct('user-id', 'product-id');

    expect(data.file).toMatchObject({
      name: 'sap2000.pdf',
      download_url: 'https://files.example/sap2000.pdf',
    });
  });

  it('returns 404 without access', async () => {
    query.mockResolvedValue([]);

    await expect(
      service.findProduct('user-id', 'product-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
