import { MigrationInterface, QueryRunner } from 'typeorm';

const COLUMNS = [
  'email_order_paid',
  'email_learner_announcement',
  'email_application_submitted',
  'email_merchant_registered',
  'email_pro_paid',
  'email_interview_scheduled',
  'email_application_result',
  'email_mentor_announcement',
  'email_merchant_announcement',
  'email_cashflow_success',
];

export class AddRoleEmailPreferences1794800000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // The column-state guard keeps the approved reset a one-time action even
    // when this migration is rerun outside TypeORM's migration ledger.
    await queryRunner.query(`
      DO $$
      DECLARE present_count integer; compatible_count integer;
      BEGIN
        LOCK TABLE user_notification_preferences IN ACCESS EXCLUSIVE MODE;
        SELECT count(*), count(*) FILTER (
          WHERE data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'true'
        ) INTO present_count, compatible_count
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'user_notification_preferences'
          AND column_name IN (${COLUMNS.map((column) => `'${column}'`).join(', ')});
        IF present_count = ${COLUMNS.length} AND compatible_count = ${COLUMNS.length} THEN
          RETURN;
        END IF;
        IF present_count <> 0 THEN
          RAISE EXCEPTION 'Role email preference columns are partial or incompatible; reconcile schema before migration';
        END IF;
        ALTER TABLE user_notification_preferences
          ${COLUMNS.map((column) => `ADD COLUMN ${column} boolean NOT NULL DEFAULT true`).join(',\n          ')};
        UPDATE user_notification_preferences
        SET email_new_sale = true, email_new_applicant = true
        WHERE email_new_sale = false OR email_new_applicant = false;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Previous opt-outs cannot be reconstructed; restoration needs the backup.
    await queryRunner.query(`ALTER TABLE user_notification_preferences
      ${COLUMNS.map((column) => `DROP COLUMN IF EXISTS ${column}`).join(',\n      ')}`);
  }
}
