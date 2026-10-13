import { FRONTEND_PATHS, greeting, paragraph, plain, strong } from './layout';
import type { ClassTutorAssignedEmail } from './payloads';
import type { EmailTemplate } from './template';

// The frontend's names for the tutor roles.
const ROLE_LABELS: Record<ClassTutorAssignedEmail['role'], string> = {
  lead: 'Lead Tutor / Instruktur Utama',
  assistant: 'Asisten Tutor',
  moderator: 'Moderator Live Session',
};

export const classTutorAssigned: EmailTemplate<ClassTutorAssignedEmail> = (
  tutor,
  link,
) => {
  const course = strong(tutor.class_title);
  const store = strong(tutor.store_name);
  const role = strong(ROLE_LABELS[tutor.role]);
  return {
    subject: `Kamu ditugaskan di kelas ${tutor.class_title}`,
    title: 'Ditugaskan sebagai tutor',
    preheader: `${tutor.store_name} menambahkan kamu sebagai ${ROLE_LABELS[tutor.role]}.`,
    blocks: [
      greeting(tutor.mentor_name),
      paragraph(
        `${store.html} menambahkan kamu sebagai ${role.html} di kelas ${course.html}.`,
        `${store.text} menambahkan kamu sebagai ${role.text} di kelas ${course.text}.`,
      ),
      plain(
        'Hak akses kamu di kelas ini diatur oleh merchant. Kelas ini sekarang muncul di daftar kelas pada dashboard mentor.',
      ),
    ],
    button: {
      label: 'Lihat kelas saya',
      url: link(FRONTEND_PATHS.mentorClasses),
    },
  };
};
