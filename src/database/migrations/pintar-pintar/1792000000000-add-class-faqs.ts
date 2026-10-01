import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the per-class FAQ managed from the class editor ("Kelola FAQ") and
 * shown on the class pages. Safe to re-run.
 */
export class AddClassFaqs1792000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_faqs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        class_id uuid NOT NULL REFERENCES classes(id),
        question varchar(300) NOT NULL,
        answer text NOT NULL,
        created_by varchar,
        updated_by varchar,
        deleted_by varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_class_faqs_class ON class_faqs (class_id, created_at) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS class_faqs');
  }
}
