import { MigrationInterface, QueryRunner } from 'typeorm';

// Indexes for the foreign keys that request paths filter on (audit DB-3). The
// other unindexed foreign keys are reached only through the parent's primary
// key or point at rows that are soft-deleted, never deleted, so an index would
// cost writes without serving a query. Plain (not `deleted_at`) predicates, so
// the same index also serves foreign-key checks; nullable item references are
// partial on `IS NOT NULL` because most rows reference another item kind.
const INDEXES: ReadonlyArray<{ name: string; definition: string }> = [
  // Tutors of a class (every class page and tutor permission check) and the
  // class-and-mentor pair check.
  {
    name: 'idx_class_mentors_class_mentor',
    definition: 'class_mentors (class_id, mentor_id)',
  },
  // Classes a mentor teaches (mentor profile and dashboard).
  { name: 'idx_class_mentors_mentor', definition: 'class_mentors (mentor_id)' },
  // A learner's submissions across a class (learner metrics, certificates).
  { name: 'idx_submissions_user', definition: 'submissions (user_id)' },
  // Buyers of a product (merchant downloads count, reviews, student counts).
  { name: 'idx_user_access_product', definition: 'user_access (product_id)' },
  // Answers of a submission (grading; replaced on resubmission).
  {
    name: 'idx_submission_answers_submission',
    definition: 'submission_answers (submission_id)',
  },
  // Questions of an assignment (assignment lists, submission scoring).
  {
    name: 'idx_assignment_questions_assignment',
    definition: 'assignment_questions (assignment_id)',
  },
  // Bundles containing a class or product (edit, unpublish and delete checks).
  {
    name: 'idx_bundle_items_class',
    definition: 'bundle_items (class_id) WHERE class_id IS NOT NULL',
  },
  {
    name: 'idx_bundle_items_product',
    definition: 'bundle_items (product_id) WHERE product_id IS NOT NULL',
  },
  // Like counts of community threads and replies (every feed page).
  {
    name: 'idx_community_likes_thread',
    definition: 'community_likes (thread_id) WHERE thread_id IS NOT NULL',
  },
  {
    name: 'idx_community_likes_reply',
    definition: 'community_likes (reply_id) WHERE reply_id IS NOT NULL',
  },
];

export class IndexForeignKeys1795500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { name, definition } of INDEXES) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${name} ON ${definition}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { name } of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
    }
  }
}
