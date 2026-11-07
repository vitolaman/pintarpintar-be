import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCertificationRequests1795300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS certification_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        organization_name varchar(200) NOT NULL,
        organization_profile text,
        organization_email varchar(255) NOT NULL,
        organization_phone varchar(32) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_certification_requests_created
      ON certification_requests (created_at DESC, id DESC)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS certification_requests');
  }
}
