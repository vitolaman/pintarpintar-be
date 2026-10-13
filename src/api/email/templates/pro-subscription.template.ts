import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  plain,
  rupiah,
  smallPrint,
  strong,
  tanggal,
  wib,
} from './layout';
import { paymentChannelName } from '../../payment/payment-methods';
import type {
  ProAwaitingPaymentEmail,
  ProFailedEmail,
  ProPaidEmail,
} from './payloads';
import type { EmailTemplate } from './template';

const planLabel = (pro: { plan_name: string; duration_months: number }) =>
  `${pro.plan_name} (${pro.duration_months} bulan)`;

export const proAwaitingPayment: EmailTemplate<ProAwaitingPaymentEmail> = (
  pro,
) => {
  const deadline = wib(pro.expires_at);
  return {
    subject: `Selesaikan pembayaran Pro Subscription ${pro.transaction_number}`,
    title: 'Menunggu pembayaran Pro Subscription',
    preheader: `Bayar sebelum ${deadline} agar Pro Subscription bisa aktif.`,
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Pendaftaran Pro Subscription kamu sudah dibuat. Mohon selesaikan pembayaran sebelum <b>${deadline}</b>. Pro Subscription aktif setelah pembayaran diterima.`,
        `Pendaftaran Pro Subscription kamu sudah dibuat. Mohon selesaikan pembayaran sebelum ${deadline}. Pro Subscription aktif setelah pembayaran diterima.`,
      ),
      infoRows([
        ['Nomor transaksi', pro.transaction_number],
        ['Paket', planLabel(pro)],
        ['Total pembayaran', rupiah(pro.total_amount)],
        ['Batas pembayaran', deadline],
      ]),
      smallPrint('Abaikan email ini jika kamu sudah membayar.'),
    ],
    button: { label: 'Bayar sekarang', url: pro.payment_url },
  };
};

export const proPaid: EmailTemplate<ProPaidEmail> = (pro, link) => {
  const until = strong(tanggal(pro.pro_until));
  // A paid transaction without a channel was a Rp0 plan.
  const method =
    pro.total_amount === 0 ? 'Gratis' : paymentChannelName(pro.payment_method);
  return {
    subject: 'Pro Subscription kamu sudah aktif',
    title: 'Pro Subscription aktif',
    preheader: `Pro Subscription berlaku sampai ${tanggal(pro.pro_until)}.`,
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Terima kasih, pembayaran kamu sudah kami terima. Pro Subscription kamu aktif dan berlaku sampai ${until.html}.`,
        `Terima kasih, pembayaran kamu sudah kami terima. Pro Subscription kamu aktif dan berlaku sampai ${until.text}.`,
      ),
      infoRows([
        ['Nomor transaksi', pro.transaction_number],
        ['Paket', planLabel(pro)],
        ['Total dibayar', rupiah(pro.total_amount)],
        ['Waktu pembayaran', wib(pro.paid_at)],
        ['Metode pembayaran', method],
        ['Berlaku sampai', tanggal(pro.pro_until)],
      ]),
      plain(
        'Semua benefit Pro Subscription, termasuk unggah file tanpa batas ukuran per file, sudah bisa kamu gunakan.',
      ),
    ],
    button: {
      label: 'Buka Dashboard',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};

export const proFailed: EmailTemplate<ProFailedEmail> = (pro, link) => {
  const number = strong(pro.transaction_number);
  return {
    subject: `Pembayaran Pro Subscription ${pro.transaction_number} gagal`,
    title: 'Pembayaran Pro Subscription gagal',
    preheader: 'Pembayaran tidak berhasil diproses.',
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Pembayaran Pro Subscription ${number.html} belum berhasil diproses, sehingga Pro Subscription belum aktif. Silahkan daftar ulang Pro Subscription untuk mencoba lagi.`,
        `Pembayaran Pro Subscription ${number.text} belum berhasil diproses, sehingga Pro Subscription belum aktif. Silahkan daftar ulang Pro Subscription untuk mencoba lagi.`,
      ),
      infoRows([
        ['Paket', planLabel(pro)],
        ['Total pembayaran', rupiah(pro.total_amount)],
      ]),
      plain(
        'Jika butuh bantuan, silahkan hubungi kami lewat halaman Bantuan dengan menyertakan nomor transaksi.',
      ),
    ],
    button: { label: 'Coba lagi', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};
