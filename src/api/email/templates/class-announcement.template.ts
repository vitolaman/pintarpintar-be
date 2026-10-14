import { FRONTEND_PATHS, greeting, noteBox, paragraph, strong } from './layout';
import type { ClassAnnouncementEmail } from './payloads';
import type { EmailTemplate } from './template';

const BUTTONS: Record<
  ClassAnnouncementEmail['audience'],
  { label: string; path: (typeof FRONTEND_PATHS)[keyof typeof FRONTEND_PATHS] }
> = {
  learner: { label: 'Buka Portal Saya', path: FRONTEND_PATHS.portal },
  tutor: {
    label: 'Buka diskusi kelas',
    path: FRONTEND_PATHS.mentorDiscussions,
  },
  merchant: { label: 'Buka dashboard', path: FRONTEND_PATHS.merchantDashboard },
};

export const classAnnouncement: EmailTemplate<ClassAnnouncementEmail> = (
  announcement,
  link,
) => {
  const course = strong(announcement.class_title);
  const author = strong(announcement.author_name);
  const button = BUTTONS[announcement.audience];
  return {
    subject: `Pengumuman baru di kelas ${announcement.class_title}`,
    title: 'Pengumuman baru',
    preheader: announcement.title,
    blocks: [
      greeting(announcement.recipient_name),
      paragraph(
        `${author.html} membuat pengumuman baru di kelas ${course.html}.`,
        `${author.text} membuat pengumuman baru di kelas ${course.text}.`,
      ),
      noteBox(announcement.title, announcement.excerpt),
    ],
    button: { label: button.label, url: link(button.path) },
  };
};
