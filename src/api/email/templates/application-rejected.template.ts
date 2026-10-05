import { FRONTEND_PATHS, greeting, paragraph, plain, strong } from './layout';
import type { ApplicationEmail } from './payloads';
import type { EmailTemplate } from './template';

export const applicationRejected: EmailTemplate<ApplicationEmail> = (
  application,
  link,
) => {
  const job = strong(application.job_title);
  const store = strong(application.store_name);
  return {
    subject: `Kabar lamaran kamu untuk ${application.job_title}`,
    title: 'Kabar lamaran kamu',
    preheader: `Kabar dari ${application.store_name}.`,
    blocks: [
      greeting(application.applicant_name),
      paragraph(
        `Terima kasih atas minat kamu pada posisi ${job.html} di ${store.html}. Setelah meninjau, merchant belum dapat melanjutkan lamaran kamu kali ini.`,
        `Terima kasih atas minat kamu pada posisi ${job.text} di ${store.text}. Setelah meninjau, merchant belum dapat melanjutkan lamaran kamu kali ini.`,
      ),
      plain('Lowongan lain tetap terbuka di Job Board.'),
    ],
    button: {
      label: 'Lihat lowongan lain',
      url: link(FRONTEND_PATHS.jobBoard),
    },
  };
};
