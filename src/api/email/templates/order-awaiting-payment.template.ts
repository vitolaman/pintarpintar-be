import {
  greeting,
  infoRows,
  itemTable,
  paragraph,
  smallPrint,
  wib,
} from './layout';
import type { OrderAwaitingPaymentEmail } from './payloads';
import type { EmailTemplate } from './template';

export const orderAwaitingPayment: EmailTemplate<OrderAwaitingPaymentEmail> = (
  order,
) => {
  const deadline = wib(order.expires_at);
  return {
    subject: `Selesaikan pembayaran pesanan ${order.order_number}`,
    title: 'Menunggu pembayaran',
    preheader: `Bayar sebelum ${deadline} agar pesanan tidak dibatalkan.`,
    blocks: [
      greeting(order.buyer_name),
      paragraph(
        `Pesanan kamu sudah dibuat. Selesaikan pembayaran sebelum <b>${deadline}</b>. Setelah itu pesanan dibatalkan otomatis.`,
        `Pesanan kamu sudah dibuat. Selesaikan pembayaran sebelum ${deadline}. Setelah itu pesanan dibatalkan otomatis.`,
      ),
      infoRows([
        ['Nomor pesanan', order.order_number],
        ['Batas pembayaran', deadline],
      ]),
      itemTable(order.items, {
        discount: order.discount_amount,
        totalLabel: 'Total pembayaran',
        total: order.total_amount,
      }),
      smallPrint('Abaikan email ini jika kamu sudah membayar.'),
    ],
    button: { label: 'Bayar sekarang', url: order.payment_url },
  };
};
