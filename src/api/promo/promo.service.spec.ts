import { CatalogService } from '../catalog/catalog.service';
import { VoucherService } from '../voucher/voucher.service';
import { PromoService } from './promo.service';

describe('PromoService', () => {
  let catalogService: { findCards: jest.Mock; withViewerFlags: jest.Mock };
  let voucherService: { findRandomPublic: jest.Mock };
  let service: PromoService;

  beforeEach(() => {
    catalogService = {
      findCards: jest.fn().mockResolvedValue([]),
      withViewerFlags: jest.fn(async (_viewer, cards: object[]) => cards),
    };
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

  it('keeps the featured strip out of the voucher list when enough vouchers exist', async () => {
    const picked = voucherIds(9);
    voucherService.findRandomPublic.mockResolvedValue(picked);

    const response = await service.findVouchers({ limit: 6 } as never);

    expect(voucherService.findRandomPublic).toHaveBeenCalledWith(9);
    expect(response).toEqual({
      data: { featured: picked.slice(0, 3), vouchers: picked.slice(3) },
      responseMessage: 'Get promo vouchers success',
    });
  });

  it('tops up a short voucher list with featured vouchers', async () => {
    const picked = voucherIds(7);
    voucherService.findRandomPublic.mockResolvedValue(picked);

    const { data } = await service.findVouchers({ limit: 6 } as never);

    expect(data.featured).toEqual(picked.slice(0, 3));
    expect(data.vouchers).toEqual([...picked.slice(3), ...picked.slice(0, 2)]);
  });

  it('lists every voucher when fewer than the featured count exist', async () => {
    const picked = voucherIds(2);
    voucherService.findRandomPublic.mockResolvedValue(picked);

    const { data } = await service.findVouchers({ limit: 6 } as never);

    expect(data).toEqual({ featured: picked, vouchers: picked });
  });
});

function voucherIds(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `voucher-${index}`,
  }));
}
