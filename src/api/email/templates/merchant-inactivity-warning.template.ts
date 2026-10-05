import {
  bulan,
  FRONTEND_PATHS,
  greeting,
  noteBox,
  paragraph,
  plain,
  strong,
} from './layout';
import type { MerchantInactivityWarningEmail } from './payloads';
import type { EmailTemplate } from './template';

export const merchantInactivityWarning: EmailTemplate<
  MerchantInactivityWarningEmail
> = (warning, link) => {
  const [first, second] = warning.quiet_months.map(bulan);
  const deadline = bulan(warning.deadline_month);
  const store = strong(warning.store_name);
  return {
    subject: `Peringatan: produk ${warning.store_name} akan dihapus`,
    title: 'Produk kamu akan dihapus',
    preheader: `Belum ada transaksi selama 2 bulan. Batas: akhir ${deadline}.`,
    blocks: [
      greeting(warning.owner_name),
      paragraph(
        `Belum ada transaksi di ${store.html} selama dua bulan terakhir (${first} dan ${second}).`,
        `Belum ada transaksi di ${store.text} selama dua bulan terakhir (${first} dan ${second}).`,
      ),
      noteBox(
        'Yang terjadi jika tetap tidak ada transaksi',
        `Jika sampai akhir ${deadline} belum ada transaksi, semua produk digital, kelas, bootcamp, dan bundling di toko kamu dihapus otomatis, dan diskon serta voucher dinonaktifkan.`,
      ),
      plain(
        'Satu transaksi saja sebelum batas waktu sudah cukup untuk membatalkan penghapusan.',
      ),
    ],
    button: {
      label: 'Kelola toko',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};
