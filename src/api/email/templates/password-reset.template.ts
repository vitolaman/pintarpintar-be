import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  plain,
  smallPrint,
  wib,
} from './layout';
import type { PasswordResetEmail } from './payloads';
import type { EmailTemplate } from './template';

export const passwordReset: EmailTemplate<PasswordResetEmail> = (
  reset,
  link,
) => {
  if (!reset.reset_token) {
    throw new Error('the reset token was already removed');
  }
  const until = wib(reset.expires_at);
  const url = `${link(FRONTEND_PATHS.resetPassword)}?token=${encodeURIComponent(reset.reset_token)}`;
  return {
    subject: 'Atur ulang kata sandi akun Pintar Pintar',
    title: 'Atur ulang kata sandi',
    preheader: `Tautan berlaku sampai ${until}.`,
    blocks: [
      greeting(reset.user_name),
      plain(
        'Kami menerima permintaan untuk mengatur ulang kata sandi akun kamu. Klik tombol di bawah untuk membuat kata sandi baru.',
      ),
      infoRows([['Berlaku sampai', until]]),
      smallPrint(
        'Tautan hanya bisa dipakai sekali. Jika kamu tidak meminta ini, abaikan email ini; kata sandi kamu tidak berubah.',
      ),
    ],
    button: { label: 'Atur ulang kata sandi', url },
  };
};
