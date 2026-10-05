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
  if (change.via_reset) {
    return {
      subject: 'Kata sandi akun Pintar Pintar kamu telah diubah',
      title: 'Kata sandi diubah',
      preheader: `Kata sandi diatur ulang pada ${when}.`,
      blocks: [
        greeting(change.user_name),
        paragraph(
          `Kata sandi akun ${email.html} diatur ulang lewat tautan email pada ${when}. Demi keamanan, akun kamu sudah dikeluarkan dari semua perangkat. Masuk lagi dengan kata sandi baru.`,
          `Kata sandi akun ${email.text} diatur ulang lewat tautan email pada ${when}. Demi keamanan, akun kamu sudah dikeluarkan dari semua perangkat. Masuk lagi dengan kata sandi baru.`,
        ),
        noteBox(
          'Bukan kamu?',
          'Hubungi kami segera lewat halaman Bantuan agar akun kamu bisa diamankan.',
        ),
      ],
      button: { label: 'Masuk', url: link(FRONTEND_PATHS.login) },
    };
  }
  return {
    subject: 'Kata sandi akun Pintar Pintar kamu telah diubah',
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
