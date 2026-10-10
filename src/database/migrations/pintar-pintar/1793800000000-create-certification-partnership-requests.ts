import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Requests from institutions to issue certificates through Pintar Pintar
 * ("Ajukan Kerjasama Sertifikasi"). Stored only; the follow-up process is not
 * defined yet. `user_id` is set when the visitor was signed in. Safe to re-run.
 */
export class CreateCertificationPartnershipRequests1793800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS certification_partnership_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        institution_name varchar(200) NOT NULL,
        profile text,
        email varchar(255) NOT NULL,
        phone varchar(32) NOT NULL,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_certification_partnership_requests_created
       ON certification_partnership_requests (created_at DESC) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS certification_partnership_requests',
    );
  }
}
