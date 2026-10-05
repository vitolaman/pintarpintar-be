import {
  FRONTEND_PATHS,
  greeting,
  noteBox,
  paragraph,
  strong,
  wib,
} from './layout';
import type { PasswordChangedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const passwordChanged: EmailTemplate<PasswordChangedEmail> = (
  change,
  link,
) => {
  const when = wib(change.changed_at);
  const email = strong(change.email);
  return {
    subject: 'Kata sandi akun Pintar Pintar kamu diubah',
    title: 'Kata sandi diubah',
    preheader: `Kata sandi diubah pada ${when}.`,
    blocks: [
      greeting(change.user_name),
      paragraph(
        `Kata sandi akun ${email.html} diubah pada ${when}. Demi keamanan, akun kamu sudah dikeluarkan dari semua perangkat lain.`,
        `Kata sandi akun ${email.text} diubah pada ${when}. Demi keamanan, akun kamu sudah dikeluarkan dari semua perangkat lain.`,
      ),
      noteBox(
        'Bukan kamu?',
        'Hubungi kami segera lewat halaman Bantuan agar akun kamu bisa diamankan.',
      ),
    ],
    button: {
      label: 'Buka pengaturan keamanan',
      url: link(FRONTEND_PATHS.security),
    },
  };
};
