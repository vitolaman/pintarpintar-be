import {
  Block,
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  plain,
  rupiah,
  strong,
  wib,
} from './layout';
import type { WithdrawalOutcomeEmail } from './payloads';
import type { EmailTemplate } from './template';

function withdrawalFacts(withdrawal: WithdrawalOutcomeEmail): Block {
  return infoRows([
    ['Jumlah penarikan', rupiah(withdrawal.amount)],
    ['Biaya penarikan', rupiah(withdrawal.fee_amount)],
    ['Dana ditransfer', rupiah(withdrawal.amount - withdrawal.fee_amount)],
    ['Rekening tujuan', withdrawal.destination],
    ['Waktu pengajuan', wib(withdrawal.requested_at)],
  ]);
}

export const withdrawalSucceeded: EmailTemplate<WithdrawalOutcomeEmail> = (
  withdrawal,
  link,
) => {
  const store = strong(withdrawal.store_name);
  return {
    subject: `Penarikan saldo ${rupiah(withdrawal.amount)} berhasil`,
    title: 'Penarikan saldo berhasil',
    preheader: `${rupiah(withdrawal.amount - withdrawal.fee_amount)} sudah ditransfer ke rekening tujuan.`,
    blocks: [
      greeting(withdrawal.owner_name),
      paragraph(
        `Penarikan saldo dari ${store.html} sudah ditransfer ke rekening tujuan.`,
        `Penarikan saldo dari ${store.text} sudah ditransfer ke rekening tujuan.`,
      ),
      withdrawalFacts(withdrawal),
    ],
    button: { label: 'Lihat saldo', url: link(FRONTEND_PATHS.balance) },
  };
};

// Says nothing about the balance: no code returns a failed withdrawal's
// amount, so the email must not promise it.
export const withdrawalFailed: EmailTemplate<WithdrawalOutcomeEmail> = (
  withdrawal,
  link,
) => {
  const store = strong(withdrawal.store_name);
  return {
    subject: `Penarikan saldo ${rupiah(withdrawal.amount)} gagal diproses`,
    title: 'Penarikan saldo gagal',
    preheader: 'Penarikan saldo tidak berhasil diproses.',
    blocks: [
      greeting(withdrawal.owner_name),
      paragraph(
        `Penarikan saldo dari ${store.html} gagal diproses.`,
        `Penarikan saldo dari ${store.text} gagal diproses.`,
      ),
      withdrawalFacts(withdrawal),
      plain(
        'Silahkan periksa rekening pencairan di pengaturan merchant, atau hubungi kami lewat halaman Bantuan.',
      ),
    ],
    button: { label: 'Lihat saldo', url: link(FRONTEND_PATHS.balance) },
  };
};
