import { FRONTEND_PATHS, greeting, paragraph, plain, strong } from './layout';
import type { MerchantItemsRemovedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const merchantItemsRemoved: EmailTemplate<MerchantItemsRemovedEmail> = (
  removal,
  link,
) => {
  const store = strong(removal.store_name);
  const count = removal.removed_count;
  return {
    subject: `Produk ${removal.store_name} telah dihapus`,
    title: 'Produk telah dihapus',
    preheader: `${count} produk dan kelas dihapus karena tidak ada transaksi.`,
    blocks: [
      greeting(removal.owner_name),
      paragraph(
        `Karena tidak ada transaksi selama tiga bulan berturut-turut, <b>${count}</b> produk, kelas, bootcamp, dan bundling di ${store.html} telah dihapus. Diskon dan voucher toko juga dinonaktifkan.`,
        `Karena tidak ada transaksi selama tiga bulan berturut-turut, ${count} produk, kelas, bootcamp, dan bundling di ${store.text} telah dihapus. Diskon dan voucher toko juga dinonaktifkan.`,
      ),
      plain(
        'Riwayat pesanan, saldo, dan ulasan tetap tersimpan. Kamu bisa menambahkan produk baru kapan saja.',
      ),
    ],
    button: {
      label: 'Buka dashboard',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};
