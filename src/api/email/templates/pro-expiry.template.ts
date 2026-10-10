import { FRONTEND_PATHS, greeting, paragraph, strong, tanggal } from './layout';
import type { ProExpiryEmail } from './payloads';
import type { EmailTemplate } from './template';

// Firm wording: the merchant is told one end date and never extra or
// remaining time (owner decision 2026-10-10).

export const proExpiring: EmailTemplate<ProExpiryEmail> = (pro, link) => {
  const store = strong(pro.store_name);
  const date = strong(tanggal(pro.end_date));
  return {
    subject: `Masa Pro kamu berakhir pada ${tanggal(pro.end_date)}`,
    title: 'Masa Pro segera berakhir',
    preheader: `Perpanjang Pro sebelum ${tanggal(pro.end_date)}.`,
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Masa Pro ${store.html} berakhir pada ${date.html}. Silahkan perpanjang Pro sebelum tanggal tersebut.`,
        `Masa Pro ${store.text} berakhir pada ${date.text}. Silahkan perpanjang Pro sebelum tanggal tersebut.`,
      ),
    ],
    button: { label: 'Perpanjang Pro', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};

export const proNotRenewed: EmailTemplate<ProExpiryEmail> = (pro, link) => {
  const store = strong(pro.store_name);
  const date = strong(tanggal(pro.end_date));
  return {
    subject: `Masa Pro kamu belum diperpanjang dan akan berakhir pada ${tanggal(pro.end_date)}`,
    title: 'Masa Pro belum diperpanjang',
    preheader: `Masa Pro berakhir pada ${tanggal(pro.end_date)}.`,
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Masa Pro ${store.html} belum diperpanjang dan akan berakhir pada ${date.html}. Silahkan perpanjang Pro sebelum tanggal tersebut.`,
        `Masa Pro ${store.text} belum diperpanjang dan akan berakhir pada ${date.text}. Silahkan perpanjang Pro sebelum tanggal tersebut.`,
      ),
    ],
    button: { label: 'Perpanjang Pro', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};

export const proEnded: EmailTemplate<ProExpiryEmail> = (pro, link) => {
  const store = strong(pro.store_name);
  const date = strong(tanggal(pro.end_date));
  return {
    subject: 'Masa Pro kamu telah berakhir',
    title: 'Masa Pro telah berakhir',
    preheader: 'Benefit Pro tidak berlaku lagi.',
    blocks: [
      greeting(pro.owner_name),
      paragraph(
        `Masa Pro ${store.html} telah berakhir pada ${date.html}.`,
        `Masa Pro ${store.text} telah berakhir pada ${date.text}.`,
      ),
      paragraph(
        'Benefit Pro, termasuk unggah file tanpa batas ukuran per file, tidak berlaku lagi. Silahkan daftar ulang Pro untuk mendapatkannya kembali.',
      ),
    ],
    button: { label: 'Daftar Ulang Pro', url: link(FRONTEND_PATHS.proUpgrade) },
  };
};
