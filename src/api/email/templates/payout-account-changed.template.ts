import {
  FRONTEND_PATHS,
  greeting,
  noteBox,
  paragraph,
  strong,
  wib,
} from './layout';
import type {
  PayoutAccountAction,
  PayoutAccountChangedEmail,
} from './payloads';
import type { EmailTemplate } from './template';

const ACTIONS: Record<PayoutAccountAction, string> = {
  added: 'ditambahkan',
  updated: 'diubah',
  deleted: 'dihapus',
  primary: 'dijadikan rekening utama',
};

export const payoutAccountChanged: EmailTemplate<PayoutAccountChangedEmail> = (
  change,
  link,
) => {
  const action = ACTIONS[change.action];
  const account = strong(`${change.bank_name} ${change.masked_account_number}`);
  const store = strong(change.store_name);
  const holder = change.account_holder_name;
  const when = wib(change.changed_at);
  return {
    subject: `Rekening pencairan ${action}`,
    title: 'Rekening pencairan diperbarui',
    preheader: `${change.bank_name} ${change.masked_account_number} ${action}.`,
    blocks: [
      greeting(change.owner_name),
      paragraph(
        `Rekening ${account.html} a.n. ${strong(holder).html} telah ${action} di toko ${store.html} pada ${when}.`,
        `Rekening ${account.text} a.n. ${holder} telah ${action} di toko ${store.text} pada ${when}.`,
      ),
      noteBox(
        'Bukan kamu?',
        'Segera ganti kata sandi akun kamu dan hubungi kami lewat halaman Bantuan.',
      ),
    ],
    button: {
      label: 'Buka pengaturan toko',
      url: link(FRONTEND_PATHS.merchantSettings),
    },
  };
};
