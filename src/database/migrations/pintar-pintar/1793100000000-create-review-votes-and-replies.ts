import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Membantu" marks and replies under class and digital-product reviews.
 * A user marks a review at most once; removing a mark deletes its row.
 * Each reply keeps the role its author had when writing it. Safe to re-run.
 */
export class CreateReviewVotesAndReplies1793100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS review_helpful_votes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        review_id uuid NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_review_helpful_votes_review_user UNIQUE (review_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS review_replies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        review_id uuid NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        author_role varchar(16) NOT NULL,
        comment text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_review_replies_author_role
          CHECK (author_role IN ('merchant', 'mentor', 'buyer'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_review_replies_review ON review_replies (review_id, created_at) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS review_replies');
    await queryRunner.query('DROP TABLE IF EXISTS review_helpful_votes');
  }
}
