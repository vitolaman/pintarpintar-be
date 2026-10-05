import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  strong,
  wibDate,
} from './layout';
import type { CertificateIssuedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const certificateIssued: EmailTemplate<CertificateIssuedEmail> = (
  certificate,
  link,
) => {
  const course = strong(certificate.class_title);
  return {
    subject: `Sertifikat ${certificate.class_title} sudah terbit`,
    title: 'Sertifikat kamu sudah terbit',
    preheader: `Nomor sertifikat ${certificate.certificate_number}.`,
    blocks: [
      greeting(certificate.learner_name),
      paragraph(
        `Selamat telah menyelesaikan ${course.html}! Sertifikat kamu sudah terbit dan bisa dilihat di profil kamu.`,
        `Selamat telah menyelesaikan ${course.text}! Sertifikat kamu sudah terbit dan bisa dilihat di profil kamu.`,
      ),
      infoRows([
        ['Nomor sertifikat', certificate.certificate_number],
        ['Diterbitkan oleh', certificate.store_name],
        ['Tanggal terbit', wibDate(certificate.issued_at)],
      ]),
    ],
    button: { label: 'Lihat sertifikat', url: link(FRONTEND_PATHS.profile) },
  };
};
