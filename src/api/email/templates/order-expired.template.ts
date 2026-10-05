import {
  FRONTEND_PATHS,
  greeting,
  itemTable,
  paragraph,
  plain,
  strong,
} from './layout';
import type { OrderClosedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const orderExpired: EmailTemplate<OrderClosedEmail> = (order, link) => {
  const number = strong(order.order_number);
  return {
    subject: `Pesanan ${order.order_number} kedaluwarsa`,
    title: 'Pesanan kedaluwarsa',
    preheader: 'Batas waktu pembayaran sudah lewat.',
    blocks: [
      greeting(order.buyer_name),
      paragraph(
        `Batas waktu pembayaran pesanan ${number.html} sudah lewat, jadi pesanan dibatalkan otomatis. Tidak ada dana yang ditarik.`,
        `Batas waktu pembayaran pesanan ${number.text} sudah lewat, jadi pesanan dibatalkan otomatis. Tidak ada dana yang ditarik.`,
      ),
      itemTable(order.items, {
        totalLabel: 'Total pesanan',
        total: order.total_amount,
      }),
      plain('Kamu bisa memesan ulang kapan saja.'),
    ],
    button: { label: 'Pesan ulang', url: link(FRONTEND_PATHS.cart) },
  };
};
