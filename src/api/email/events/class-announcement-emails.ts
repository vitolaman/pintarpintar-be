import { EntityManager } from 'typeorm';
import { guardEmailQueue, queueEmails } from '../email-queue';

const EXCERPT_LENGTH = 300;

type Audience = 'learner' | 'tutor' | 'merchant';

interface RecipientRow {
  user_id: string;
  name: string;
  email: string;
  audience: Audience;
}

// Everyone in the class except the author, once each: the merchant owner,
// the active tutors, and the learners with an active enrollment. A person in
// several groups gets the button of the first one (merchant, tutor, learner).
const RECIPIENTS_SQL = `
  WITH thread AS (
    SELECT id, class_id, author_id FROM discussion_threads WHERE id = $1
  ),
  members AS (
    SELECT merchant.user_id, 'merchant' AS audience, 1 AS rank
    FROM thread
    INNER JOIN classes class ON class.id = thread.class_id
    INNER JOIN merchants merchant
      ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
    UNION ALL
    SELECT mentor.user_id, 'tutor', 2
    FROM thread
    INNER JOIN class_mentors link
      ON link.class_id = thread.class_id AND link.deleted_at IS NULL
    INNER JOIN mentors mentor
      ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL AND mentor.status = 'active'
    UNION ALL
    SELECT enrollment.user_id, 'learner', 3
    FROM thread
    INNER JOIN enrollments enrollment
      ON enrollment.class_id = thread.class_id AND enrollment.deleted_at IS NULL
  )
  SELECT DISTINCT ON (member.user_id) member.user_id, member.audience,
         account.name, account.email
  FROM members member
  INNER JOIN users account ON account.id = member.user_id AND account.deleted_at IS NULL
  CROSS JOIN thread
  WHERE member.user_id <> thread.author_id
  ORDER BY member.user_id, member.rank`;

/**
 * Called in the transaction that creates a `Pengumuman` thread. Queues one
 * email per recipient in bulk; the sender delivers them in the background.
 */
export async function queueClassAnnouncementEmails(
  manager: EntityManager,
  threadId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'class announcement', async (manager) => {
    const [thread]: Array<{
      title: string;
      content: string;
      class_title: string;
      author_name: string;
    }> = await manager.query(
      `SELECT thread.title, thread.content, class.title AS class_title,
              author.name AS author_name
       FROM discussion_threads thread
       INNER JOIN classes class ON class.id = thread.class_id
       INNER JOIN users author ON author.id = thread.author_id
       WHERE thread.id = $1`,
      [threadId],
    );
    if (!thread) return;
    const recipients: RecipientRow[] = await manager.query(RECIPIENTS_SQL, [
      threadId,
    ]);
    const excerpt = excerptOf(thread.content);
    await queueEmails(
      manager,
      recipients.map((recipient) => ({
        kind: 'class_announcement',
        to: recipient.email,
        userId: recipient.user_id,
        dedupeKey: `announcement:${threadId}:${recipient.user_id}`,
        payload: {
          recipient_name: recipient.name,
          audience: recipient.audience,
          class_title: thread.class_title,
          author_name: thread.author_name,
          title: thread.title,
          excerpt,
        },
      })),
    );
  });
}

// The start of the text on one line, cut at a word within 300 characters.
export function excerptOf(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > EXCERPT_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
