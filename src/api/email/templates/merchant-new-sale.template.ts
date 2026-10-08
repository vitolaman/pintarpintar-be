import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  itemTable,
  paragraph,
  rupiah,
  smallPrint,
  strong,
  tanggal,
  wib,
} from './layout';
import type { MerchantNewSaleEmail } from './payloads';
import type { EmailTemplate } from './template';

// The PM's basic "payment received" wording (2026-10-07).
export const merchantNewSale: EmailTemplate<MerchantNewSaleEmail> = (
  sale,
  link,
) => {
  const amount = strong(rupiah(sale.net_total));
  const products = strong(sale.items.map((item) => item.title).join(', '));
  return {
    subject: 'Pembayaran baru diterima',
    title: 'Pembayaran baru diterima',
    preheader: `Pembayaran ${rupiah(sale.net_total)} untuk ${sale.store_name} sudah diterima.`,
    blocks: [
      greeting(sale.owner_name),
      paragraph(
        `Pembayaran berhasil diterima sebesar ${amount.html} pada pembelian produk ${products.html}. Silahkan cek riwayat transaksi pada dashboard merchant.`,
        `Pembayaran berhasil diterima sebesar ${amount.text} pada pembelian produk ${products.text}. Silahkan cek riwayat transaksi pada dashboard merchant.`,
      ),
      infoRows([
        ['Nomor pesanan', sale.order_number],
        ['Pembeli', sale.buyer_name],
        // A sale counts once paid, so its time is the payment time.
        ['Waktu transaksi', wib(sale.paid_at)],
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
    button: {
      label: 'Buka Dashboard Merchant',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};
