import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  noteBox,
  paragraph,
  strong,
  wib,
} from './layout';
import type { SubmissionGradedEmail } from './payloads';
import type { EmailTemplate } from './template';

export const submissionGraded: EmailTemplate<SubmissionGradedEmail> = (
  grade,
  link,
) => {
  const score =
    grade.max_score === null
      ? String(grade.score)
      : `${grade.score} / ${grade.max_score}`;
  const course = strong(grade.class_title);
  return {
    subject: `Tugas ${grade.assignment_title} sudah dinilai`,
    title: 'Tugas sudah dinilai',
    preheader: `Nilai kamu: ${score}.`,
    blocks: [
      greeting(grade.learner_name),
      paragraph(
        `Tugas kamu di kelas ${course.html} sudah dinilai.`,
        `Tugas kamu di kelas ${course.text} sudah dinilai.`,
      ),
      infoRows([
        ['Tugas', grade.assignment_title],
        ['Nilai', score],
        ['Dinilai pada', wib(grade.graded_at)],
      ]),
      ...(grade.feedback
        ? [noteBox('Masukan dari mentor', grade.feedback)]
        : []),
    ],
    button: { label: 'Buka Portal Saya', url: link(FRONTEND_PATHS.portal) },
  };
};
