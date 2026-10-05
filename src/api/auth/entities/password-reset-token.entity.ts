import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

/** A single-use reset link; the token itself is never stored. */
@Entity({ name: 'password_reset_tokens' })
export class PasswordResetToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Hex SHA-256 of the token sent in the email.
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
