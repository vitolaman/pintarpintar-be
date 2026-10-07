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
        `Pesanan kamu sudah dibuat. Mohon selesaikan pembayaran sebelum <b>${deadline}</b>. Pesanan akan dibatalkan otomatis jika lewat dari batas waktu.`,
        `Pesanan kamu sudah dibuat. Mohon selesaikan pembayaran sebelum ${deadline}. Pesanan akan dibatalkan otomatis jika lewat dari batas waktu.`,
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
