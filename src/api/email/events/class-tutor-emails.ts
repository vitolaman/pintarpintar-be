import { EntityManager } from 'typeorm';
import { guardEmailQueue, queueEmails } from '../email-queue';

/**
 * Called in the invite transaction once the tutor link exists. Mentors have
 * no notification switches, so it always goes out, once per assignment.
 */
export async function queueClassTutorAssignedEmail(
  manager: EntityManager,
  classMentorId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'class tutor assigned', async (manager) => {
    const [row]: Array<{
      id: string;
      role: 'lead' | 'assistant' | 'moderator';
      class_title: string;
      store_name: string;
      mentor_user_id: string;
      mentor_name: string;
      mentor_email: string;
    }> = await manager.query(
      `SELECT link.id, link.role, class.title AS class_title, merchant.store_name,
              mentor_user.id AS mentor_user_id, mentor_user.name AS mentor_name,
              mentor_user.email AS mentor_email
       FROM class_mentors link
       INNER JOIN classes class ON class.id = link.class_id
       INNER JOIN merchants merchant ON merchant.id = class.merchant_id
       INNER JOIN mentors mentor ON mentor.id = link.mentor_id
       INNER JOIN users mentor_user
         ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
       WHERE link.id = $1 AND link.deleted_at IS NULL`,
      [classMentorId],
    );
    if (!row) return;
    await queueEmails(manager, [
      {
        kind: 'class_tutor_assigned',
        to: row.mentor_email,
        userId: row.mentor_user_id,
        dedupeKey: `class-tutor:${row.id}:assigned`,
        payload: {
          mentor_name: row.mentor_name,
          class_title: row.class_title,
          store_name: row.store_name,
          role: row.role,
        },
      },
    ]);
  });
}
