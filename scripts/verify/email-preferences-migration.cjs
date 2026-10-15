// Runs only on an isolated local database created and removed by this script.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const dotenv = require('dotenv');
const {
  AddRoleEmailPreferences1794800000000,
} = require('../../dist/database/migrations/pintar-pintar/1794800000000-add-role-email-preferences');

const columns = [
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

async function main() {
  const config = dotenv.parse(readFileSync(process.argv[2]));
  const database = `pp_email_migration_${process.pid}`;
  const connection = {
    host: '127.0.0.1',
    port: Number(config.LOCAL_DB_PORT),
    user: config.LOCAL_DB_USERNAME,
    password: config.LOCAL_DB_PASSWORD,
  };
  const admin = new Client({ ...connection, database: 'postgres' });
  const client = new Client({ ...connection, database });
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    await client.connect();
    await client.query(`CREATE TABLE users (id uuid PRIMARY KEY);
      CREATE TABLE user_notification_preferences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id),
        email_new_sale boolean NOT NULL DEFAULT true, email_new_applicant boolean NOT NULL DEFAULT true,
        email_new_review boolean NOT NULL DEFAULT true, email_weekly_report boolean NOT NULL DEFAULT true,
        whatsapp_new_order boolean NOT NULL DEFAULT true, whatsapp_payout_approved boolean NOT NULL DEFAULT true,
        whatsapp_student_chat boolean NOT NULL DEFAULT false, promotion_broadcast boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp
      );
      INSERT INTO users VALUES ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
      INSERT INTO user_notification_preferences (user_id, email_new_sale, email_new_applicant, email_new_review, whatsapp_new_order)
      VALUES ('10000000-0000-4000-8000-000000000001', false, false, false, false)`);
    const runner = {
      query: async (sql, parameters) =>
        (await client.query(sql, parameters)).rows,
    };
    const migration = new AddRoleEmailPreferences1794800000000();
    const before = (
      await client.query('SELECT * FROM user_notification_preferences')
    ).rows[0];
    await migration.up(runner);
    const after = (
      await client.query('SELECT * FROM user_notification_preferences')
    ).rows[0];
    for (const column of columns) assert.equal(after[column], true, column);
    assert.equal(after.email_new_sale, true);
    assert.equal(after.email_new_applicant, true);
    for (const column of Object.keys(before).filter(
      (key) => !['email_new_sale', 'email_new_applicant'].includes(key),
    )) {
      assert.deepEqual(after[column], before[column], `preserved ${column}`);
    }
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS count FROM user_notification_preferences',
        )
      ).rows[0].count,
      1,
    );
    await client.query(
      'UPDATE user_notification_preferences SET email_order_paid=false, email_new_sale=false',
    );
    await migration.up(runner);
    const rerun = (
      await client.query(
        'SELECT email_order_paid,email_new_sale FROM user_notification_preferences',
      )
    ).rows[0];
    assert.deepEqual(rerun, { email_order_paid: false, email_new_sale: false });
    await client.query(
      `ALTER TABLE user_notification_preferences ALTER COLUMN email_order_paid DROP NOT NULL`,
    );
    await assert.rejects(migration.up(runner), /partial or incompatible/);
    await client.query(
      `ALTER TABLE user_notification_preferences ALTER COLUMN email_order_paid SET NOT NULL`,
    );
    await migration.down(runner);
    assert.equal(
      (
        await client.query(
          'SELECT email_new_sale FROM user_notification_preferences',
        )
      ).rows[0].email_new_sale,
      false,
    );
    await client.query(
      `ALTER TABLE user_notification_preferences ADD COLUMN email_order_paid boolean NOT NULL DEFAULT true`,
    );
    await assert.rejects(migration.up(runner), /partial or incompatible/);
    await client.query(
      'ALTER TABLE user_notification_preferences DROP COLUMN email_order_paid',
    );
    await migration.up(runner);
    assert.equal(
      (
        await client.query(
          'SELECT email_new_sale FROM user_notification_preferences',
        )
      ).rows[0].email_new_sale,
      true,
    );
    await client.query(
      `INSERT INTO user_notification_preferences (user_id) VALUES ('10000000-0000-4000-8000-000000000002')`,
    );
    const fresh = (
      await client.query(
        `SELECT * FROM user_notification_preferences WHERE user_id='10000000-0000-4000-8000-000000000002'`,
      )
    ).rows[0];
    for (const column of columns) assert.equal(fresh[column], true);
    console.log(
      'PASS migration defaults/reset, unrelated data preservation, rerun, incompatible/partial guard, down/up and new-row defaults',
    );
  } finally {
    await client.end();
    if (created) await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(`FAIL migration verification: ${error.code || error.name}`);
  process.exitCode = 1;
});
