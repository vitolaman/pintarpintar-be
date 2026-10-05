import { FRONTEND_PATHS, greeting, paragraph, strong } from './layout';
import type { ApplicationAcceptedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const applicationAccepted: EmailTemplate<ApplicationAcceptedEmail> = (
  application,
  link,
) => {
  const job = strong(application.job_title);
  const store = strong(application.store_name);
  const course = application.class_title
    ? strong(application.class_title)
    : null;
  return {
    subject: `Selamat, lamaran kamu untuk ${application.job_title} diterima`,
    title: 'Lamaran diterima',
    preheader: `Kamu bergabung dengan ${application.store_name}.`,
    blocks: [
      greeting(application.applicant_name),
      paragraph(
        `Selamat! ${store.html} menerima lamaran kamu untuk posisi ${job.html}.`,
        `Selamat! ${store.text} menerima lamaran kamu untuk posisi ${job.text}.`,
      ),
      ...(course
        ? [
            paragraph(
              `Kamu sekarang terdaftar sebagai mentor di kelas ${course.html}.`,
              `Kamu sekarang terdaftar sebagai mentor di kelas ${course.text}.`,
            ),
          ]
        : []),
    ],
    button: {
      label: 'Buka dashboard mentor',
      url: link(FRONTEND_PATHS.mentorDashboard),
    },
  };
};
