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

export const orderFailed: EmailTemplate<OrderClosedEmail> = (order, link) => {
  const number = strong(order.order_number);
  return {
    subject: `Pembayaran pesanan ${order.order_number} gagal`,
    title: 'Pembayaran gagal',
    preheader: 'Pembayaran tidak berhasil diproses.',
    blocks: [
      greeting(order.buyer_name),
      paragraph(
        `Pembayaran pesanan ${number.html} tidak berhasil diproses oleh penyedia pembayaran, jadi pesanan dibatalkan.`,
        `Pembayaran pesanan ${number.text} tidak berhasil diproses oleh penyedia pembayaran, jadi pesanan dibatalkan.`,
      ),
      itemTable(order.items, {
        totalLabel: 'Total pesanan',
        total: order.total_amount,
      }),
      plain(
        'Jika saldo kamu terpotong, hubungi kami lewat halaman Bantuan dengan menyertakan nomor pesanan.',
      ),
    ],
    button: { label: 'Pesan ulang', url: link(FRONTEND_PATHS.cart) },
  };
};
