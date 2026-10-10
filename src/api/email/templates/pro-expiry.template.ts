import { FRONTEND_PATHS, greeting, paragraph, strong, tanggal } from './layout';
import type { ProExpiryEmail } from './payloads';
import type { EmailTemplate } from './template';

// Firm wording: the merchant is told one end date and never extra or
// remaining time (owner decision 2026-10-10).

export const proExpiring: EmailTemplate<ProExpiryEmail> = (pro, link) => {
  const store = strong(pro.store_name);
  const date = strong(tanggal(pro.end_date));
  return {
    subject: `Pro Subscription kamu berakhir pada ${tanggal(pro.end_date)}`,
    title: 'Pro Subscription segera berakhir',
    preheader: `Perpanjang Pro Subscription sebelum ${tanggal(pro.end_date)}.`,
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Pro Subscription ${store.html} berakhir pada ${date.html}. Silahkan perpanjang Pro Subscription sebelum tanggal tersebut.`,
        `Pro Subscription ${store.text} berakhir pada ${date.text}. Silahkan perpanjang Pro Subscription sebelum tanggal tersebut.`,
      ),
    ],
    button: { label: 'Perpanjang Pro', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};

export const proNotRenewed: EmailTemplate<ProExpiryEmail> = (pro, link) => {
  const store = strong(pro.store_name);
  const date = strong(tanggal(pro.end_date));
  return {
    subject: `Pro Subscription kamu belum diperpanjang dan akan berakhir pada ${tanggal(pro.end_date)}`,
    title: 'Pro Subscription belum diperpanjang',
    preheader: `Pro Subscription berakhir pada ${tanggal(pro.end_date)}.`,
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Pro Subscription ${store.html} belum diperpanjang dan akan berakhir pada ${date.html}. Silahkan perpanjang Pro Subscription sebelum tanggal tersebut.`,
        `Pro Subscription ${store.text} belum diperpanjang dan akan berakhir pada ${date.text}. Silahkan perpanjang Pro Subscription sebelum tanggal tersebut.`,
      ),
    ],
    button: { label: 'Perpanjang Pro', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};

export const proEnded: EmailTemplate<ProExpiryEmail> = (pro, link) => {
  const store = strong(pro.store_name);
  const date = strong(tanggal(pro.end_date));
  return {
    subject: 'Pro Subscription kamu telah berakhir',
    title: 'Pro Subscription telah berakhir',
    preheader: 'Benefit Pro Subscription tidak berlaku lagi.',
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Pro Subscription ${store.html} telah berakhir pada ${date.html}.`,
        `Pro Subscription ${store.text} telah berakhir pada ${date.text}.`,
      ),
      paragraph(
        'Benefit Pro Subscription, termasuk unggah file tanpa batas ukuran per file, tidak berlaku lagi. Silahkan daftar ulang Pro Subscription untuk mendapatkannya kembali.',
      ),
    ],
    button: { label: 'Daftar Ulang Pro', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};
