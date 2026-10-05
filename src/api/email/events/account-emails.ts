import { EntityManager } from 'typeorm';
import { guardEmailQueue, queueEmails } from '../email-queue';

/** A security notice after a password change; `tokenVersion` names it. */
export async function queuePasswordChangedEmail(
  manager: EntityManager,
  user: { id: string; name: string; email: string; tokenVersion: number },
  options: { viaReset?: boolean } = {},
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
          ...(options.viaReset ? { via_reset: true } : {}),
        },
      },
    ]);
  });
}

/**
 * The reset link email. It expires with its token, so it is never sent once
 * the link no longer works; the token leaves the stored copy after delivery.
 */
export async function queuePasswordResetEmail(
  manager: EntityManager,
  reset: {
    tokenId: string;
    token: string;
    expiresAt: Date;
    user: { id: string; name: string; email: string };
  },
): Promise<void> {
  await guardEmailQueue(manager, 'password reset', async (manager) => {
    await queueEmails(manager, [
      {
        kind: 'password_reset',
        to: reset.user.email,
        userId: reset.user.id,
        dedupeKey: `password-reset:${reset.tokenId}`,
        payload: {
          user_name: reset.user.name,
          reset_token: reset.token,
          expires_at: reset.expiresAt.toISOString(),
        },
        expiresAt: reset.expiresAt,
      },
    ]);
  });
}
