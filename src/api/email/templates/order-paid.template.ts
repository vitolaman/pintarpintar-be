import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  itemTable,
  noteBox,
  paymentMethodLabel,
  plain,
  sectionHeading,
  wib,
} from './layout';
import type { OrderPaidEmail } from './payloads';
import type { EmailTemplate } from './template';

/** The receipt; each item's merchant instructions follow the item list. */
export const orderPaid: EmailTemplate<OrderPaidEmail> = (order, link) => {
  const withInstructions = order.items.filter((line) => line.instructions);
  return {
    subject: `Pembayaran berhasil: ${order.order_number}`,
    title: 'Pembayaran berhasil',
    preheader: 'Pembelian kamu sudah bisa diakses di Portal Saya.',
    blocks: [
      greeting(order.buyer_name),
      plain(
        'Terima kasih, pembayaran kamu sudah kami terima. Kelas dan produk yang kamu beli sekarang bisa diakses di Portal Saya.',
      ),
      infoRows([
        ['Nomor pesanan', order.order_number],
        ['Waktu pembayaran', wib(order.paid_at)],
        ['Metode pembayaran', paymentMethodLabel(order.payment_method)],
      ]),
      itemTable(order.items, {
        discount: order.discount_amount,
        totalLabel: 'Total dibayar',
        total: order.total_amount,
      }),
      ...(withInstructions.length
        ? [
            sectionHeading('Instruksi dari merchant'),
            ...withInstructions.map((line) =>
              noteBox(
                line.merchant ? `${line.title} · ${line.merchant}` : line.title,
                line.instructions as string,
              ),
            ),
          ]
        : []),
    ],
    button: { label: 'Buka Portal Saya', url: link(FRONTEND_PATHS.portal) },
  };
};
