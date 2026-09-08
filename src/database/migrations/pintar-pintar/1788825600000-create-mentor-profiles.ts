import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMentorProfiles1788825600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE mentors (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status varchar NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE TABLE mentor_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        mentor_id uuid NOT NULL UNIQUE REFERENCES mentors(id) ON DELETE CASCADE,
        expertise varchar NOT NULL,
        experience_years integer NOT NULL,
        education varchar NOT NULL,
        portfolio_url varchar,
        linkedin_url varchar NOT NULL,
        cv_asset_id uuid NOT NULL REFERENCES file_assets(id) ON DELETE RESTRICT,
        skill_certificate_asset_id uuid NOT NULL REFERENCES file_assets(id) ON DELETE RESTRICT,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_mentor_profiles_experience_years CHECK (experience_years >= 0)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX idx_mentors_active_user ON mentors (user_id) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_mentors_active_user');
    await queryRunner.query('DROP TABLE mentor_profiles');
    await queryRunner.query('DROP TABLE mentors');
  }
}
