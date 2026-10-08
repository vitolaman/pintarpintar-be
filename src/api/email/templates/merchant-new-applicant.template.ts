import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  strong,
  wib,
} from './layout';
import type { MerchantNewApplicantEmail } from './payloads';
import type { EmailTemplate } from './template';

// Names the applicant only; contact details and documents stay in the
// merchant dashboard.
export const merchantNewApplicant: EmailTemplate<MerchantNewApplicantEmail> = (
  application,
  link,
) => {
  const applicant = strong(application.applicant_name);
  const job = strong(application.job_title);
  const store = strong(application.store_name);
  return {
    subject: `Lamaran baru untuk ${application.job_title}`,
    title: 'Lamaran baru',
    preheader: `${application.applicant_name} melamar posisi ${application.job_title}.`,
    blocks: [
      greeting(application.owner_name),
      paragraph(
        `${applicant.html} melamar posisi ${job.html} di ${store.html}.`,
        `${applicant.text} melamar posisi ${job.text} di ${store.text}.`,
      ),
      infoRows([
        ['Pelamar', application.applicant_name],
        ['Posisi', application.job_title],
        ['Waktu melamar', wib(application.applied_at)],
      ]),
    ],
    button: { label: 'Lihat pelamar', url: link(FRONTEND_PATHS.jobPosting) },
  };
};
