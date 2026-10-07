import {
  FRONTEND_PATHS,
  greeting,
  itemTable,
  paragraph,
  strong,
} from './layout';
import type { OrderClosedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const orderExpired: EmailTemplate<OrderClosedEmail> = (order, link) => {
  const number = strong(order.order_number);
  return {
    subject: `Pesanan ${order.order_number} kedaluwarsa`,
    title: 'Pesanan kedaluwarsa',
    preheader: 'Batas waktu pembayaran telah kadaluwarsa.',
    blocks: [
      greeting(order.buyer_name),
      paragraph(
        `Batas waktu pembayaran pesanan ${number.html} telah habis. Pesanan dibatalkan secara otomatis. Tidak ada dana yang terpotong.`,
        `Batas waktu pembayaran pesanan ${number.text} telah habis. Pesanan dibatalkan secara otomatis. Tidak ada dana yang terpotong.`,
      ),
      itemTable(order.items, {
        totalLabel: 'Total pesanan',
        total: order.total_amount,
      }),
    ],
    button: { label: 'Pesan ulang', url: link(FRONTEND_PATHS.cart) },
  };
};
