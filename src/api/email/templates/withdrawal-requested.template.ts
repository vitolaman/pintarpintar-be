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
import type { WithdrawalRequestedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const withdrawalRequested: EmailTemplate<WithdrawalRequestedEmail> = (
  withdrawal,
  link,
) => {
  const transfer = withdrawal.amount - withdrawal.fee_amount;
  const store = strong(withdrawal.store_name);
  return {
    subject: `Penarikan saldo ${rupiah(withdrawal.amount)} diajukan`,
    title: 'Penarikan saldo diajukan',
    preheader: `${rupiah(transfer)} akan ditransfer ke ${withdrawal.bank_name}.`,
    blocks: [
      greeting(withdrawal.owner_name),
      paragraph(
        `Pengajuan penarikan saldo dari ${store.html} sudah kami terima dan akan diproses.`,
        `Pengajuan penarikan saldo dari ${store.text} sudah kami terima dan akan diproses.`,
      ),
      infoRows([
        ['Jumlah penarikan', rupiah(withdrawal.amount)],
        ['Biaya penarikan', rupiah(withdrawal.fee_amount)],
        ['Diterima', rupiah(transfer)],
        [
          'Rekening tujuan',
          `${withdrawal.bank_name} ${withdrawal.masked_account_number}\na.n. ${withdrawal.account_holder_name}`,
        ],
        ['Waktu pengajuan', wib(withdrawal.requested_at)],
      ]),
      smallPrint('Status penarikan bisa dipantau di halaman Saldo.'),
    ],
    button: { label: 'Lihat saldo', url: link(FRONTEND_PATHS.balance) },
  };
};
