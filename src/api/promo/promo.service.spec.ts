import { CatalogService } from '../catalog/catalog.service';
import { VoucherService } from '../voucher/voucher.service';
import { PromoService } from './promo.service';

describe('PromoService', () => {
  let catalogService: { findCards: jest.Mock };
  let voucherService: { findRandomPublic: jest.Mock };
  let service: PromoService;

  beforeEach(() => {
    catalogService = { findCards: jest.fn().mockResolvedValue([]) };
    voucherService = { findRandomPublic: jest.fn().mockResolvedValue([]) };
    service = new PromoService(
      catalogService as unknown as CatalogService,
      voucherService as unknown as VoucherService,
    );
  });

  it('picks random discounted classes and bootcamps by default', async () => {
    await service.findItems({ type: 'kelas', limit: 6 } as never);

    expect(catalogService.findCards).toHaveBeenCalledWith(
      { types: ['kelas', 'bootcamp'], discountedOnly: true },
      'random',
      6,
    );
  });

  it('honours an explicit sort for discounted digital products', async () => {
    await service.findItems({
      type: 'digital',
      sort: 'termurah',
      limit: 4,
    } as never);

    expect(catalogService.findCards).toHaveBeenCalledWith(
      { types: ['digital'], discountedOnly: true },
      'termurah',
      4,
    );
  });

  it('picks random public vouchers', async () => {
    await expect(service.findVouchers({ limit: 6 } as never)).resolves.toEqual({
      data: [],
      responseMessage: 'Get promo vouchers success',
    });
    expect(voucherService.findRandomPublic).toHaveBeenCalledWith(6);
  });
});
