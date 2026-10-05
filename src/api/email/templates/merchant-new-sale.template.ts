import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  itemTable,
  paragraph,
  smallPrint,
  strong,
  tanggal,
  wib,
} from './layout';
import type { MerchantNewSaleEmail } from './payloads';
import type { EmailTemplate } from './template';

export const merchantNewSale: EmailTemplate<MerchantNewSaleEmail> = (
  sale,
  link,
) => {
  const buyer = strong(sale.buyer_name);
  const store = strong(sale.store_name);
  return {
    subject: `Penjualan baru: ${sale.order_number}`,
    title: 'Ada penjualan baru',
    preheader: `${sale.buyer_name} membeli dari ${sale.store_name}.`,
    blocks: [
      greeting(sale.owner_name),
      paragraph(
        `${buyer.html} baru saja membeli dari ${store.html}.`,
        `${buyer.text} baru saja membeli dari ${store.text}.`,
      ),
      infoRows([
        ['Nomor pesanan', sale.order_number],
        ['Waktu pembayaran', wib(sale.paid_at)],
      ]),
      itemTable(sale.items, {
        totalLabel: 'Pendapatan bersih',
        total: sale.net_total,
      }),
      ...(sale.settlement_date
        ? [
            smallPrint(
              `Pendapatan ini bisa ditarik mulai ${tanggal(sale.settlement_date)}.`,
            ),
          ]
        : []),
    ],
    button: { label: 'Lihat penjualan', url: link(FRONTEND_PATHS.sales) },
  };
};
