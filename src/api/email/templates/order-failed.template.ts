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
        `Pembayaran pesanan ${number.html} belum berhasil diproses, pesanan telah dibatalkan.`,
        `Pembayaran pesanan ${number.text} belum berhasil diproses, pesanan telah dibatalkan.`,
      ),
      itemTable(order.items, {
        totalLabel: 'Total pesanan',
        total: order.total_amount,
      }),
      plain(
        'Jika butuh bantuan, silahkan hubungi kami lewat halaman Bantuan dengan menyertakan nomor pesanan.',
      ),
    ],
    button: { label: 'Pesan ulang', url: link(FRONTEND_PATHS.cart) },
  };
};
