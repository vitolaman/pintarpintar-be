import { EntityManager } from 'typeorm';
import { EmailToQueue, guardEmailQueue, queueEmails } from '../email-queue';

interface ApplicationRow {
  id: string;
  applicant_user_id: string;
  applicant_name: string;
  applicant_email: string;
  job_title: string;
  store_name: string;
  class_title: string | null;
}

export type ApplicationEvent =
  | { type: 'submitted' }
  | { type: 'accepted' }
  | { type: 'rejected' }
  | {
      type: 'interview';
      // ISO time with offset, as the merchant sent it.
      interviewAt: string;
      interviewUrl: string | null;
      rescheduled: boolean;
      previousInterviewAt: Date | null;
    };

/**
 * Emails the applicant at the address given in the application form, which
 * is the contact the applicant chose for this job.
 */
export async function queueApplicationEmail(
  manager: EntityManager,
  applicationId: string,
  event: ApplicationEvent,
): Promise<void> {
  await guardEmailQueue(
    manager,
    `application ${event.type}`,
    async (manager) => {
      const [row]: ApplicationRow[] = await manager.query(
        `SELECT application.id, application.applicant_user_id,
              application.name AS applicant_name, application.email AS applicant_email,
              job.title AS job_title, merchant.store_name, class.title AS class_title
       FROM job_applications application
       INNER JOIN job_postings job ON job.id = application.job_posting_id
       INNER JOIN merchants merchant ON merchant.id = job.merchant_id
       LEFT JOIN classes class ON class.id = job.class_id AND class.deleted_at IS NULL
       WHERE application.id = $1`,
        [applicationId],
      );
      if (!row) return;
      const base = {
        applicant_name: row.applicant_name,
        job_title: row.job_title,
        store_name: row.store_name,
      };
      const recipient = {
        to: row.applicant_email,
        userId: row.applicant_user_id,
      };
      const key = `application:${row.id}`;
      let email: EmailToQueue;
      switch (event.type) {
        case 'submitted':
          email = {
            kind: 'application_submitted',
            ...recipient,
            dedupeKey: `${key}:submitted`,
            payload: base,
          };
          break;
        case 'accepted':
          email = {
            kind: 'application_accepted',
            ...recipient,
            dedupeKey: `${key}:accepted`,
            payload: { ...base, class_title: row.class_title },
          };
          break;
        case 'rejected':
          email = {
            kind: 'application_rejected',
            ...recipient,
            dedupeKey: `${key}:rejected`,
            payload: base,
          };
          break;
        case 'interview': {
          const interviewAt = new Date(event.interviewAt).toISOString();
          email = {
            kind: 'interview_scheduled',
            ...recipient,
            dedupeKey: `${key}:interview:${interviewAt}`,
            payload: {
              ...base,
              interview_at: interviewAt,
              interview_url: event.interviewUrl,
              rescheduled: event.rescheduled,
              previous_interview_at: event.previousInterviewAt
                ? new Date(event.previousInterviewAt).toISOString()
                : null,
            },
          };
          break;
        }
      }
      await queueEmails(manager, [email]);
    },
  );
}
