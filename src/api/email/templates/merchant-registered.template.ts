import { FRONTEND_PATHS, greeting, paragraph, plain, strong } from './layout';
import type { MerchantRegisteredEmail } from './payloads';
import type { EmailTemplate } from './template';

export const merchantRegistered: EmailTemplate<MerchantRegisteredEmail> = (
  registration,
  link,
) => {
  const store = strong(registration.store_name);
  return {
    subject: 'Pendaftaran merchant kamu berhasil',
    title: 'Merchant kamu sudah terdaftar',
    preheader: `${registration.store_name} sudah aktif di Pintar Pintar.`,
    blocks: [
      greeting(registration.owner_name),
      paragraph(
        `Pendaftaran ${store.html} sebagai merchant berhasil.`,
        `Pendaftaran ${store.text} sebagai merchant berhasil.`,
      ),
      plain(
        'Toko kamu sudah aktif. Kamu bisa mulai mengelola produk melalui dashboard merchant.',
      ),
    ],
    button: {
      label: 'Buka dashboard merchant',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};
