// Explicitly authorized development-account tests; secrets and responses stay in memory.
// Usage: node scripts/verify/email-preferences-live.cjs <env-file> <account-email> --allow-account-updates [--allow-email-fixtures]
process.env.TZ = 'UTC';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { Client } = require('pg');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const {
  EMAIL_PREFERENCE_FIELDS,
  MERCHANT_PREFERENCE_FIELDS,
} = require('../../dist/api/notification-preferences/preference-fields');
const { verifyEmailWorker } = require('./email-preferences-live-worker.cjs');

const base = 'https://api.pintarpintar.id';
const profilePath = '/api/v1/profile/notification-preferences';
const merchantPath = '/api/v1/merchant/notification-preferences';
const keys = Object.keys(EMAIL_PREFERENCE_FIELDS);
const merchantKeys = Object.keys(MERCHANT_PREFERENCE_FIELDS);
const allKeys = [...new Set([...keys, ...merchantKeys])];
const all = (value) => Object.fromEntries(keys.map((key) => [key, value]));
let stage = 'configuration';

async function parallel(items, concurrency, operation) {
  let next = 0;
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await operation(items[index], index);
      }
    }),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
}

function summary(times, elapsed) {
  const sorted = [...times].sort((a, b) => a - b);
  const percentile = (fraction) =>
    Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2));
  return {
    count: times.length,
    p50_ms: percentile(0.5),
    p95_ms: percentile(0.95),
    p99_ms: percentile(0.99),
    requests_per_second: Number(((times.length * 1000) / elapsed).toFixed(1)),
  };
}

async function main() {
  assert(
    process.argv.includes('--allow-account-updates'),
    'Explicit account-update approval required',
  );
  const config = dotenv.parse(readFileSync(process.argv[2]));
  const email = process.argv[3];
  assert(email && config.JWT_ADMIN_KEY?.trim());
  const connection = {
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,
    connectionTimeoutMillis: 10000,
    options:
      '-c default_transaction_read_only=on -c statement_timeout=10000 -c timezone=UTC',
    application_name: 'owner-approved-email-preferences-live-test',
  };
  const db = new Client(connection);
  let snapshot;
  let account;
  let token;
  let mutationStarted = false;
  let workerSafeToRestore = true;
  let restored = false;
  let restoreFailure;
  const metrics = [];
  const checks = [];
  let workerEvidence = null;
  let baselineBusiness;
  let baselineRows;
  let deadlocksBefore;
  let monitor;
  let monitorRunning = false;
  let monitorTask;
  let monitorError;
  const locks = {
    samples: 0,
    max_shared_db_waiters: 0,
    max_observed_shared_db_wait_ms: 0,
  };

  async function request(
    path,
    method = 'GET',
    body,
    expected = 200,
    authenticate = true,
  ) {
    const start = performance.now();
    const result = await fetch(base + path, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        ...(authenticate ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(
      result.status,
      expected,
      `Unexpected HTTP status during ${stage}`,
    );
    const data = await result.json();
    return { data, elapsed: performance.now() - start };
  }
  const get = async (path) => (await request(path)).data.data;
  const patch = async (values) =>
    (await request(profilePath, 'PATCH', values)).data.data;
  const databasePreferences = async () =>
    (
      await db.query(
        `SELECT id, ${allKeys.join(', ')} FROM user_notification_preferences WHERE user_id = $1 AND deleted_at IS NULL`,
        [account.id],
      )
    ).rows;
  const business = async () =>
    (
      await db.query(
        `SELECT u.is_merchant, u.is_mentor, u.token_version,
      (SELECT jsonb_agg(jsonb_build_object('id', m.id, 'status', m.status, 'deleted', m.deleted_at IS NOT NULL) ORDER BY m.id)
       FROM merchants m WHERE m.user_id = u.id) AS merchants,
      (SELECT jsonb_agg(jsonb_build_object('id', w.id, 'earning', w.earning_balance, 'settled', w.settled_balance, 'lifetime', w.lifetime_earnings) ORDER BY w.id)
       FROM merchant_wallets w JOIN merchants m ON m.id = w.merchant_id WHERE m.user_id = u.id) AS wallets
     FROM users u WHERE u.id = $1`,
        [account.id],
      )
    ).rows;

  try {
    stage = 'account authorization and snapshot';
    await db.connect();
    assert.equal(
      (await db.query('SHOW default_transaction_read_only')).rows[0]
        .default_transaction_read_only,
      'on',
    );
    const { rows } = await db.query(
      `SELECT u.id, u.token_version, u.name, m.store_name FROM users u JOIN merchants m ON m.user_id = u.id
       WHERE lower(u.email) = lower($1) AND u.deleted_at IS NULL AND m.deleted_at IS NULL AND m.status = 'active'`,
      [email],
    );
    assert.equal(rows.length, 1);
    account = rows[0];
    token = jwt.sign(
      { id: account.id, tv: account.token_version },
      config.JWT_ADMIN_KEY.trim(),
      { expiresIn: '15m' },
    );
    snapshot = {
      profile: await get(profilePath),
      merchant: await get(merchantPath),
    };
    assert.deepEqual(Object.keys(snapshot.profile).sort(), [...keys].sort());
    assert.deepEqual(
      Object.keys(snapshot.merchant).sort(),
      [...merchantKeys].sort(),
    );
    for (const value of Object.values(snapshot.profile))
      assert.equal(typeof value, 'boolean');
    baselineRows = await databasePreferences();
    assert.equal(baselineRows.length, 1);
    baselineBusiness = await business();
    deadlocksBefore = Number(
      (
        await db.query(
          'SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()',
        )
      ).rows[0].deadlocks,
    );
    checks.push(
      'Authenticated twelve-field profile and ten-field compatible merchant reads',
    );

    stage = 'strict request validation';
    let rejected = 0;
    for (const key of keys) {
      for (const value of [null, 'false', 0]) {
        await request(profilePath, 'PATCH', { [key]: value }, 400);
        rejected++;
      }
    }
    for (const body of [
      { user_id: randomUUID() },
      { unknown: true },
      { email_weekly_report: false },
    ]) {
      await request(profilePath, 'PATCH', body, 400);
      rejected++;
    }
    for (const body of [
      { email_cashflow_success: null },
      { email_new_sale: 'false' },
      { user_id: randomUUID() },
    ]) {
      await request(merchantPath, 'PATCH', body, 400);
      rejected++;
    }
    assert.deepEqual(await get(profilePath), snapshot.profile);
    assert.deepEqual(await get(merchantPath), snapshot.merchant);
    checks.push(
      `${rejected} invalid requests rejected without preference changes`,
    );
    console.log(
      JSON.stringify({
        progress: stage,
        result: 'PASS',
        rejected_requests: rejected,
      }),
    );

    stage = 'all switches and concurrent partial writes';
    mutationStarted = true;
    assert.deepEqual(await patch(all(false)), all(false));
    const disabledMerchant = await get(merchantPath);
    for (const key of merchantKeys) {
      assert.equal(
        disabledMerchant[key],
        keys.includes(key) ? false : snapshot.merchant[key],
      );
    }
    await request(merchantPath, 'PATCH', { email_new_sale: true });
    assert.deepEqual(await get(profilePath), {
      ...all(false),
      email_new_sale: true,
    });
    await patch(all(false));
    await parallel(keys, 12, async (key) => {
      const saved = await patch({ [key]: true });
      assert.equal(saved[key], true);
    });
    assert.deepEqual(await get(profilePath), all(true));
    const merchantShared = merchantKeys.filter((key) => keys.includes(key));
    await parallel(keys, 12, async (key) => {
      await request(
        merchantShared.includes(key) ? merchantPath : profilePath,
        'PATCH',
        { [key]: false },
      );
    });
    assert.deepEqual(await get(profilePath), all(false));
    const savedRows = await databasePreferences();
    assert.equal(savedRows.length, 1);
    assert.equal(savedRows[0].id, baselineRows[0].id);
    for (const key of allKeys)
      assert.equal(
        savedRows[0][key],
        keys.includes(key) ? false : baselineRows[0][key],
      );
    await patch(snapshot.profile);
    assert.deepEqual(await get(merchantPath), snapshot.merchant);
    checks.push(
      'All twelve switches, legacy preservation, disjoint concurrent updates and cross-route consistency',
    );
    console.log(
      JSON.stringify({
        progress: stage,
        result: 'PASS',
        account_settings_restored_between_phases: true,
      }),
    );

    stage = 'bounded live endpoint performance';
    monitor = new Client(connection);
    await monitor.connect();
    monitorRunning = true;
    monitorTask = (async () => {
      while (monitorRunning) {
        try {
          const row = (
            await monitor.query(
              `SELECT count(*)::int AS waiters,
             COALESCE(max(extract(epoch FROM clock_timestamp() - l.waitstart) * 1000), 0)::float AS wait_ms
             FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
             WHERE NOT l.granted AND a.datname = current_database()`,
            )
          ).rows[0];
          locks.samples++;
          locks.max_shared_db_waiters = Math.max(
            locks.max_shared_db_waiters,
            row.waiters,
          );
          locks.max_observed_shared_db_wait_ms = Math.max(
            locks.max_observed_shared_db_wait_ms,
            row.wait_ms,
          );
        } catch (error) {
          monitorError = error;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    })();
    const operations = [
      ['profile_read', profilePath, 'GET'],
      ['merchant_read', merchantPath, 'GET'],
      ['profile_write', profilePath, 'PATCH'],
      ['merchant_write', merchantPath, 'PATCH'],
    ];
    for (const concurrency of [1, 10, 30]) {
      for (const [operation, path, method] of operations) {
        const body =
          method === 'PATCH'
            ? { email_new_sale: snapshot.profile.email_new_sale }
            : undefined;
        await parallel(
          Array.from({ length: Math.max(3, concurrency) }),
          concurrency,
          () => request(path, method, body),
        );
        const times = [];
        const started = performance.now();
        await parallel(Array.from({ length: 60 }), concurrency, async () => {
          const response = await request(path, method, body);
          times.push(response.elapsed);
          assert.equal(
            response.data.data.email_new_sale,
            snapshot.profile.email_new_sale,
          );
        });
        const result = {
          operation,
          concurrency,
          ...summary(times, performance.now() - started),
          errors: 0,
        };
        metrics.push(result);
        console.log(JSON.stringify({ metric: result }));
      }
    }
    monitorRunning = false;
    await monitorTask;
    if (monitorError) throw monitorError;
    await monitor.end();
    monitor = null;
    const deadlocksAfter = Number(
      (
        await db.query(
          'SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()',
        )
      ).rows[0].deadlocks,
    );
    assert.equal(deadlocksAfter, deadlocksBefore);
    checks.push(
      '720 measured live HTTP requests at concurrency 1/10/30; no unexpected status or deadlock counter increase',
    );

    if (process.argv.includes('--allow-email-fixtures')) {
      stage = 'deployed outbox worker';
      workerEvidence = await verifyEmailWorker({
        connection,
        db,
        account,
        email,
        patch,
        snapshot: snapshot.profile,
        setRestoreSafe: (value) => {
          workerSafeToRestore = value;
        },
        progress: (value) => console.log(JSON.stringify(value)),
      });
      checks.push(
        'Deployed worker suppressed fourteen cases, did not replay, sent one enabled registration email and removed exact fixture rows',
      );
    }
    stage = 'business preservation';
    assert.deepEqual(await business(), baselineBusiness);
    checks.push(
      'Account roles, token version, merchant status and wallet balances unchanged',
    );
  } finally {
    monitorRunning = false;
    if (monitorTask) await monitorTask;
    if (monitor) await monitor.end();
    if (snapshot && mutationStarted && workerSafeToRestore) {
      stage = 'restore account settings';
      let restoreError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await patch(snapshot.profile);
          assert.deepEqual(await get(profilePath), snapshot.profile);
          assert.deepEqual(await get(merchantPath), snapshot.merchant);
          assert.deepEqual(await databasePreferences(), baselineRows);
          restored = true;
          restoreError = null;
          break;
        } catch (error) {
          restoreError = error;
        }
      }
      console.log(JSON.stringify({ account_settings_restored: restored }));
      restoreFailure = restoreError;
    }
    token = null;
    await db.end();
    if (restoreFailure) throw restoreFailure;
  }
  assert(restored);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        checked_at: new Date().toISOString(),
        owner_reported_revision: 'a4605c0',
        token_persisted: false,
        direct_business_database_writes: false,
        settings_restored: restored,
        checks,
        metrics,
        lock_sampling: locks,
        worker: workerEvidence,
        limitations: [
          'Latency includes public-network/TLS overhead; one bounded sample per operation/concurrency, not a capacity/SLO test.',
          'Lock observations/deadlock counters cover the shared database, not exclusively these HTTP requests.',
          'No new orders, applications, merchants or payment/settlement/payout transactions were created.',
          'SMTP accepted/sent does not prove inbox placement. Runtime revision is owner-reported, not independently exposed.',
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      result: 'FAIL',
      stage,
      error_code: /^[A-Z0-9_]{2,24}$/.test(error.code ?? '')
        ? error.code
        : 'CHECK_FAILED',
    }),
  );
  process.exitCode = 1;
});
