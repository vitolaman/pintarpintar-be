import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Certificate delivery per class (the Pintar Pintar template or the
 * merchant's own link) with the template fields, a random verification code
 * per certificate for the public QR lookup, and certificate numbers unique per
 * class instead of platform-wide, because two classes may share a number
 * prefix. PP-CERT numbers stay unique platform-wide by their numbering.
 * Safe to re-run.
 */
export class AddCertificateTemplates1794300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE class_certificate_settings
        ADD COLUMN IF NOT EXISTS delivery_mode varchar NOT NULL DEFAULT 'template',
        ADD COLUMN IF NOT EXISTS certificate_url varchar(2048),
        ADD COLUMN IF NOT EXISTS number_prefix varchar(20),
        ADD COLUMN IF NOT EXISTS class_name varchar(150),
        ADD COLUMN IF NOT EXISTS mentor_name varchar(150),
        ADD COLUMN IF NOT EXISTS signature_asset_id uuid REFERENCES file_assets(id),
        ADD COLUMN IF NOT EXISTS show_score boolean NOT NULL DEFAULT false
    `);
    await this.addCheck(
      queryRunner,
      'chk_class_certificate_settings_delivery_mode',
      `delivery_mode IN ('template', 'link')`,
    );
    await this.addCheck(
      queryRunner,
      'chk_class_certificate_settings_link_url',
      `delivery_mode <> 'link' OR certificate_url IS NOT NULL`,
    );

    await queryRunner.query(
      'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS verification_code uuid',
    );
    await queryRunner.query(
      `UPDATE certificates SET verification_code = uuid_generate_v4()
       WHERE verification_code IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE certificates
        ALTER COLUMN verification_code SET DEFAULT uuid_generate_v4(),
        ALTER COLUMN verification_code SET NOT NULL
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_verification_code
       ON certificates (verification_code)`,
    );

    const [{ duplicates }] = await queryRunner.query(`
      SELECT count(*)::integer AS duplicates FROM (
        SELECT 1 FROM certificates WHERE "certNo" IS NOT NULL
        GROUP BY class_id, "certNo" HAVING count(*) > 1
      ) repeated
    `);
    if (duplicates > 0) {
      throw new Error(
        `certificates has ${duplicates} repeated (class_id, "certNo") pairs; resolve them before this migration`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_class_number
       ON certificates (class_id, "certNo") WHERE "certNo" IS NOT NULL`,
    );
    await queryRunner.query('DROP INDEX IF EXISTS uq_certificates_number');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ duplicates }] = await queryRunner.query(`
      SELECT count(*)::integer AS duplicates FROM (
        SELECT 1 FROM certificates WHERE "certNo" IS NOT NULL
        GROUP BY "certNo" HAVING count(*) > 1
      ) repeated
    `);
    if (duplicates > 0) {
      throw new Error(
        `${duplicates} certificate numbers are used by more than one class; the platform-wide unique index cannot be restored`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_number
       ON certificates ("certNo") WHERE "certNo" IS NOT NULL`,
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_certificates_class_number',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_certificates_verification_code',
    );
    await queryRunner.query(
      'ALTER TABLE certificates DROP COLUMN IF EXISTS verification_code',
    );
    await queryRunner.query(`
      ALTER TABLE class_certificate_settings
        DROP CONSTRAINT IF EXISTS chk_class_certificate_settings_link_url,
        DROP CONSTRAINT IF EXISTS chk_class_certificate_settings_delivery_mode,
        DROP COLUMN IF EXISTS show_score,
        DROP COLUMN IF EXISTS signature_asset_id,
        DROP COLUMN IF EXISTS mentor_name,
        DROP COLUMN IF EXISTS class_name,
        DROP COLUMN IF EXISTS number_prefix,
        DROP COLUMN IF EXISTS certificate_url,
        DROP COLUMN IF EXISTS delivery_mode
    `);
  }

  private async addCheck(
    queryRunner: QueryRunner,
    name: string,
    condition: string,
  ): Promise<void> {
    const [existing] = await queryRunner.query(
      'SELECT 1 FROM pg_constraint WHERE conname = $1',
      [name],
    );
    if (existing) return;
    await queryRunner.query(
      `ALTER TABLE class_certificate_settings ADD CONSTRAINT ${name} CHECK (${condition})`,
    );
  }
}
