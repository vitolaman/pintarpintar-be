import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  rupiah,
  smallPrint,
  strong,
  wib,
} from './layout';
import type { MerchantBalanceSettledEmail } from './payloads';
import type { EmailTemplate } from './template';

export const merchantBalanceSettled: EmailTemplate<
  MerchantBalanceSettledEmail
> = (settlement, link) => {
  const amount = strong(rupiah(settlement.amount));
  const store = strong(settlement.store_name);
  const orders = `${settlement.order_count} pesanan`;
  return {
    subject: `Saldo ${rupiah(settlement.amount)} siap ditarik`,
    title: 'Saldo siap ditarik',
    preheader: `Pendapatan dari ${orders} sekarang bisa ditarik.`,
    blocks: [
      greeting(settlement.owner_name),
      paragraph(
        `Pendapatan sebesar ${amount.html} dari ${orders} di ${store.html} sekarang bisa ditarik.`,
        `Pendapatan sebesar ${amount.text} dari ${orders} di ${store.text} sekarang bisa ditarik.`,
      ),
      infoRows([
        ['Saldo bertambah', rupiah(settlement.amount)],
        ['Jumlah pesanan', String(settlement.order_count)],
        ['Tanggal', wib(settlement.settled_at)],
      ]),
      smallPrint('Penarikan saldo bisa diajukan di halaman Saldo.'),
    ],
    button: { label: 'Lihat saldo', url: link(FRONTEND_PATHS.balance) },
  };
};
