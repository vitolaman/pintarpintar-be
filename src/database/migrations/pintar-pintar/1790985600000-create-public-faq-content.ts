import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePublicFaqContent1790985600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE faq_categories (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar NOT NULL,
        display_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE TABLE faqs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        faq_category_id uuid NOT NULL REFERENCES faq_categories(id) ON DELETE RESTRICT,
        question text NOT NULL,
        answer text NOT NULL,
        display_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_faq_categories_public_order
      ON faq_categories (display_order, id)
      WHERE deleted_at IS NULL AND is_active = true
    `);

    await queryRunner.query(`
      CREATE INDEX idx_faqs_public_category_order
      ON faqs (faq_category_id, display_order, id)
      WHERE deleted_at IS NULL AND is_active = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_faqs_public_category_order');
    await queryRunner.query('DROP INDEX idx_faq_categories_public_order');
    await queryRunner.query('DROP TABLE faqs');
    await queryRunner.query('DROP TABLE faq_categories');
  }
}
