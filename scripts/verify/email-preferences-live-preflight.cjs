// Usage: node scripts/verify/email-preferences-live-preflight.cjs <env-file>
// Owner-authorized post-deployment inspection. No SQL writes or authentication tokens.
process.env.TZ = 'UTC';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Client } = require('pg');
const dotenv = require('dotenv');
const {
  EMAIL_PREFERENCE_FIELDS,
  MERCHANT_PREFERENCE_FIELDS,
} = require('../../dist/api/notification-preferences/preference-fields');
const keys = Object.keys(EMAIL_PREFERENCE_FIELDS);
const base = 'https://api.pintarpintar.id';
let stage = 'configuration';

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  stage = 'deployed Swagger';
  const swagger = await request('/api-json');
  assert.equal(swagger.status, 200);
  const paths = swagger.body.paths;
  const route = '/api/v1/profile/notification-preferences';
  assert(paths[route]?.get && paths[route]?.patch);
  const schemas = swagger.body.components.schemas;
  const response = schemas.EmailPreferencesResponseDto;
  const patch = schemas.UpdateEmailPreferencesDto;
  assert.deepEqual(Object.keys(response.properties).sort(), [...keys].sort());
  assert.deepEqual([...response.required].sort(), [...keys].sort());
  assert.deepEqual(Object.keys(patch.properties).sort(), [...keys].sort());
  assert.equal(patch.required?.length ?? 0, 0);
  for (const key of keys) {
    assert.equal(response.properties[key].type, 'boolean');
    assert.equal(response.properties[key].default, true);
    assert.equal(patch.properties[key].type, 'boolean');
  }
  const merchantKeys = Object.keys(MERCHANT_PREFERENCE_FIELDS).sort();
  assert.deepEqual(
    Object.keys(schemas.NotificationPreferencesResponseDto.properties).sort(),
    merchantKeys,
  );
  stage = 'anonymous authentication';
  for (const path of [route, '/api/v1/merchant/notification-preferences']) {
    for (const method of ['GET', 'PATCH']) {
      const result = await request(path, {
        method,
        ...(method === 'PATCH' ? { body: '{}' } : {}),
      });
      assert.equal(result.status, 401);
    }
  }
  const config = dotenv.parse(readFileSync(process.argv[2]));
  const client = new Client({
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,
    connectionTimeoutMillis: 10000,
    options:
      '-c default_transaction_read_only=on -c statement_timeout=10000 -c timezone=UTC',
    application_name: 'email-preferences-live-preflight-readonly',
  });
  try {
    stage = 'migration and schema';
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const { rows: migrations } = await client.query(
      `SELECT timestamp::text, name FROM migrations WHERE name = $1`,
      ['AddRoleEmailPreferences1794800000000'],
    );
    assert.equal(migrations.length, 1);
    const { rows: columns } = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = current_schema()
         AND table_name = 'user_notification_preferences' AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [keys],
    );
    assert.equal(columns.length, 12);
    for (const column of columns) {
      assert.equal(column.data_type, 'boolean');
      assert.equal(column.is_nullable, 'NO');
      assert.equal(column.column_default, 'true');
    }
    const { rows: indexes } = await client.query(
      `SELECT count(*)::int AS count FROM pg_indexes
       WHERE schemaname = current_schema() AND tablename = 'user_notification_preferences'
         AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%(user_id)%'`,
    );
    assert(indexes[0].count >= 1);
    const { rows: preferences } = await client.query(
      `SELECT count(*)::int AS active_rows,
       count(*) FILTER (WHERE email_new_sale = false)::int AS sale_opt_outs,
       count(*) FILTER (WHERE email_new_applicant = false)::int AS applicant_opt_outs,
       count(*) FILTER (WHERE ${keys.map((key) => key + ' IS NULL').join(' OR ')})::int AS null_rows
       FROM user_notification_preferences WHERE deleted_at IS NULL`,
    );
    assert.equal(preferences[0].null_rows, 0);
    const { rows: duplicates } = await client.query(
      `SELECT count(*)::int AS count FROM (
        SELECT user_id FROM user_notification_preferences GROUP BY user_id HAVING count(*) > 1
       ) duplicate_rows`,
    );
    assert.equal(duplicates[0].count, 0);
    await client.query('ROLLBACK');
    console.log(
      JSON.stringify(
        {
          checked_at: new Date().toISOString(),
          owner_reported_revision: 'a4605c0',
          revision_header:
            'Not available; owner deployment confirmation plus matching Swagger/schema',
          swagger_paths: Object.keys(paths).length,
          profile_boolean_fields: 12,
          merchant_boolean_fields: merchantKeys.length,
          anonymous_requests_rejected: 4,
          migration: migrations[0],
          columns,
          unique_account_index_present: true,
          duplicate_preference_rows: 0,
          preference_summary: preferences[0],
          database_writes: false,
          result: 'PASS',
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      stage,
      result: 'FAIL',
      error_code: /^[A-Z0-9_]{2,24}$/.test(error.code ?? '')
        ? error.code
        : 'CHECK_FAILED',
    }),
  );
  process.exitCode = 1;
});
