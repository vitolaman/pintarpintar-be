import { FRONTEND_PATHS, greeting, paragraph, plain, strong } from './layout';
import type { ApplicationEmail } from './payloads';
import type { EmailTemplate } from './template';

export const applicationSubmitted: EmailTemplate<ApplicationEmail> = (
  application,
  link,
) => {
  const job = strong(application.job_title);
  const store = strong(application.store_name);
  return {
    subject: `Lamaran kamu untuk ${application.job_title} sudah terkirim`,
    title: 'Lamaran terkirim',
    preheader: `${application.store_name} akan meninjau lamaran kamu.`,
    blocks: [
      greeting(application.applicant_name),
      paragraph(
        `Lamaran kamu untuk posisi ${job.html} di ${store.html} sudah terkirim.`,
        `Lamaran kamu untuk posisi ${job.text} di ${store.text} sudah terkirim.`,
      ),
      plain(
        'Kami akan mengabari kamu lewat email saat ada jadwal wawancara atau keputusan dari merchant.',
      ),
    ],
    button: {
      label: 'Lihat progres lamaran',
      url: link(FRONTEND_PATHS.applications),
    },
  };
};
