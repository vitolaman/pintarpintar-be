import { EntityManager } from 'typeorm';
import { guardEmailQueue, queueEmails } from '../email-queue';

/** A security notice after a password change; `tokenVersion` names it. */
export async function queuePasswordChangedEmail(
  manager: EntityManager,
  user: { id: string; name: string; email: string; tokenVersion: number },
): Promise<void> {
  await guardEmailQueue(manager, 'password changed', async (manager) => {
    await queueEmails(manager, [
      {
        kind: 'password_changed',
        to: user.email,
        userId: user.id,
        dedupeKey: `user:${user.id}:password:${user.tokenVersion}`,
        payload: {
          user_name: user.name,
          email: user.email,
          changed_at: new Date().toISOString(),
        },
      },
    ]);
  });
}
