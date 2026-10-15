// Compare two built worktrees on fresh, identical local fixtures. Never shared data.
// Usage: node scripts/verify/email-preferences-performance.cjs <baseline-tree> <candidate-tree> <local-env>
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const dotenv = require('dotenv');
const { Client } = require('pg');

function summary(values, elapsed, queries, preferenceQueries) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction) =>
    Number(sorted[Math.ceil(fraction * sorted.length) - 1].toFixed(2));
  return {
    count: values.length,
    p50_ms: at(0.5),
    p95_ms: at(0.95),
    p99_ms: at(0.99),
    requests_per_second: Number(((values.length * 1000) / elapsed).toFixed(1)),
    queries_per_operation: queries / values.length,
    preference_queries_per_operation: preferenceQueries / values.length,
  };
}

async function runVersion(label, worktree, local) {
  const database = `pp_email_bench_${label}_${process.pid}`;
  const admin = new Client({
    host: '127.0.0.1',
    port: Number(local.LOCAL_DB_PORT),
    user: local.LOCAL_DB_USERNAME,
    password: local.LOCAL_DB_PASSWORD,
    database: 'postgres',
  });
  let created = false;
  let app;
  const metrics = {};
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    Object.assign(process.env, local, {
      ENV_FILE: '/dev/null',
      NODE_ENV: 'production',
      OTEL_SDK_DISABLED: 'true',
      TZ: 'UTC',
      DB_HOST: '127.0.0.1',
      DB_PORT: local.LOCAL_DB_PORT,
      DB_USERNAME: local.LOCAL_DB_USERNAME,
      DB_PASSWORD: local.LOCAL_DB_PASSWORD,
      DB_DATABASE: database,
      DB_POOL_MAX: '20',
      JWT_ADMIN_KEY: randomBytes(32).toString('hex'),
      MAIL_HOST: '',
      MAIL_PORT: '',
      MAIL_USERNAME: '',
      MAIL_PASSWORD: '',
      MAIL_SENDER: '',
    });
    const { Test } = require('@nestjs/testing');
    const { ValidationPipe } = require('@nestjs/common');
    const { SchedulerRegistry } = require('@nestjs/schedule');
    const { JwtService } = require('@nestjs/jwt');
    const { DataSource } = require('typeorm');
    const moduleRef = await Test.createTestingModule({
      imports: [require(join(worktree, 'dist/app.module')).AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    for (const job of app.get(SchedulerRegistry).getCronJobs().values())
      job.stop();
    const source = app.get(DataSource);
    const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const ownerId = randomUUID();
    await source.query(
      'INSERT INTO users (id,name,email,password_hash) VALUES ($1,$2,$3,$4)',
      [
        ownerId,
        'Fixture owner',
        `${ownerId}@example.test`,
        randomBytes(32).toString('hex'),
      ],
    );
    const token = app.get(JwtService).sign({ id: ownerId, tv: 0 });
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const registered = await fetch(`${base}/api/v1/merchant/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        store_name: 'Fixture store',
        store_description: 'Local performance fixture',
        terms_accepted: true,
        business_type: 'individual',
        city: 'Bandung',
        public_phone: '081234567890',
        product_types: ['kelas'],
      }),
    });
    assert.equal(registered.status, 201);
    const merchant = (await registered.json()).data;
    const { Class } = require(
      join(worktree, 'dist/class/entities/class.entity'),
    );
    const course = await source.manager.save(Class, {
      merchant_id: merchant.id,
      title: 'Fixture class',
      status: 'published',
      type: 'video',
    });
    const learnerIds = Array.from({ length: 100 }, () => randomUUID());
    await source.query(
      "INSERT INTO users (id,name,email,password_hash) SELECT id,'Fixture learner',id::text || '@example.test','fixture-not-used-for-signin' FROM unnest($1::uuid[]) AS id",
      [learnerIds],
    );
    await source.query(
      'INSERT INTO enrollments (user_id,class_id) SELECT id,$2 FROM unnest($1::uuid[]) AS id',
      [learnerIds, course.id],
    );
    const { queueClassAnnouncementEmails } = require(
      join(worktree, 'dist/api/email/events/class-announcement-emails'),
    );
    let queryCount = 0;
    let preferenceQueryCount = 0;
    const createRunner = source.createQueryRunner.bind(source);
    source.createQueryRunner = (...args) => {
      const runner = createRunner(...args);
      const query = runner.query.bind(runner);
      runner.query = (sql, ...parameters) => {
        queryCount++;
        if (sql.includes('FROM user_notification_preferences'))
          preferenceQueryCount++;
        return query(sql, ...parameters);
      };
      return runner;
    };

    async function benchmark(name, concurrency, operation, count = 120) {
      for (let i = 0; i < 5; i++) await operation(i);
      queryCount = 0;
      preferenceQueryCount = 0;
      const lockSamples = [];
      let sampling;
      let samplingError;
      const timer = setInterval(() => {
        if (sampling) return;
        sampling = admin
          .query(
            `SELECT count(DISTINCT locks.pid)::int AS waiters,
          COALESCE(max(extract(epoch FROM clock_timestamp() - locks.waitstart) * 1000), 0)::float AS wait_ms
          FROM pg_locks locks INNER JOIN pg_stat_activity activity ON activity.pid=locks.pid
          WHERE activity.datname=$1 AND NOT locks.granted`,
            [database],
          )
          .then(({ rows }) => {
            lockSamples.push(rows[0]);
          })
          .catch((error) => {
            samplingError = error;
          })
          .finally(() => {
            sampling = undefined;
          });
      }, 20);
      let next = 0;
      const durations = [];
      const started = performance.now();
      try {
        await Promise.all(
          Array.from({ length: concurrency }, async () => {
            while (next < count) {
              const index = next++;
              const before = performance.now();
              await operation(index);
              durations.push(performance.now() - before);
            }
          }),
        );
      } finally {
        clearInterval(timer);
        if (sampling) await sampling;
      }
      if (samplingError) throw samplingError;
      const result = summary(
        durations,
        performance.now() - started,
        queryCount,
        preferenceQueryCount,
      );
      result.lock_samples = lockSamples.length;
      result.max_lock_waiters = Math.max(
        0,
        ...lockSamples.map((sample) => sample.waiters),
      );
      result.max_lock_wait_ms = Number(
        Math.max(0, ...lockSamples.map((sample) => sample.wait_ms)).toFixed(2),
      );
      metrics[`${name}:c${concurrency}`] = result;
      console.log(
        JSON.stringify({
          version: label,
          operation: name,
          concurrency,
          ...result,
        }),
      );
    }

    const legacyPath = '/api/v1/merchant/notification-preferences';
    for (const concurrency of [1, 10, 30]) {
      for (const [name, method, path] of [
        ['merchant_read', 'GET', legacyPath],
        ['merchant_write', 'PATCH', legacyPath],
        ...(label === 'candidate'
          ? [
              [
                'profile_read',
                'GET',
                '/api/v1/profile/notification-preferences',
              ],
              [
                'profile_write',
                'PATCH',
                '/api/v1/profile/notification-preferences',
              ],
            ]
          : []),
      ]) {
        await benchmark(name, concurrency, async (index) => {
          const response = await fetch(`${base}${path}`, {
            method,
            headers,
            ...(method === 'PATCH'
              ? { body: JSON.stringify({ email_new_sale: index % 2 === 0 }) }
              : {}),
          });
          assert.equal(response.status, 200, `${name} response`);
          await response.json();
        });
      }
      const threadIds = Array.from({ length: 65 }, () => randomUUID());
      await source.query(
        "INSERT INTO discussion_threads (id,class_id,author_id,title,content,badge) SELECT id,$2,$3,'Fixture announcement','Fixture body','Pengumuman' FROM unnest($1::uuid[]) AS id",
        [threadIds, course.id, ownerId],
      );
      // Warmup and measured events have distinct keys, so every measured event inserts 100 rows.
      let eventIndex = 0;
      await benchmark(
        'announcement_100_recipients',
        concurrency,
        () =>
          source.transaction((manager) =>
            queueClassAnnouncementEmails(manager, threadIds[eventIndex++]),
          ),
        60,
      );
      const latest = metrics[`announcement_100_recipients:c${concurrency}`];
      assert.equal(
        latest.preference_queries_per_operation,
        label === 'candidate' ? 1 : 0,
        'One extra batched lookup, not one per recipient',
      );
    }
    const [{ rows }] = await source.query(
      "SELECT count(*)::int AS rows FROM email_outbox WHERE kind='class_announcement'",
    );
    assert.equal(
      rows,
      19500,
      '100 recipients per distinct announcement, including warmups',
    );
    console.log(
      `PASS ${label}: no HTTP errors, SQL lock/deadlock errors or dropped announcement recipients`,
    );
    return metrics;
  } finally {
    if (app) await app.close();
    if (created) await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

async function main() {
  const [baselineTree, candidateTree, envPath] = process.argv.slice(2);
  assert(
    baselineTree && candidateTree && envPath,
    'Pass baseline, candidate and local env paths',
  );
  const local = dotenv.parse(readFileSync(envPath));
  const trials = { baseline: [], candidate: [] };
  for (let round = 0; round < 3; round++) {
    // Alternate order to reduce warmup/host-load bias; no single noisy run gates delivery.
    const order =
      round % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'];
    for (const label of order)
      trials[label].push(
        await runVersion(
          label,
          label === 'baseline' ? baselineTree : candidateTree,
          local,
        ),
      );
  }
  const median = (values) => [...values].sort((a, b) => a - b)[1];
  const aggregate = (runs) =>
    Object.fromEntries(
      Object.keys(runs[0]).map((name) => [
        name,
        Object.fromEntries(
          Object.keys(runs[0][name]).map((key) => [
            key,
            key.startsWith('max_')
              ? Math.max(...runs.map((run) => run[name][key]))
              : median(runs.map((run) => run[name][key])),
          ]),
        ),
      ]),
    );
  const baseline = aggregate(trials.baseline);
  const candidate = aggregate(trials.candidate);
  for (const [name, values] of Object.entries(candidate))
    console.log(JSON.stringify({ median_of_three: name, ...values }));
  for (const [name, before] of Object.entries(baseline)) {
    const after = candidate[name];
    const extra = after.p95_ms - before.p95_ms;
    console.log(
      JSON.stringify({
        comparison: name,
        baseline_p95_ms: before.p95_ms,
        candidate_p95_ms: after.p95_ms,
        change_percent: Number(((extra * 100) / before.p95_ms).toFixed(1)),
      }),
    );
    assert(
      !(extra > 10 && after.p95_ms > before.p95_ms * 1.25),
      `${name}: investigate a material p95 regression (>25% and >10 ms)`,
    );
  }
  console.log(
    'PASS performance comparison: median of three alternating-order trials, no material p95 regression (>25% AND >10 ms); identical fixtures and pool=20',
  );
}

main().catch((error) => {
  console.error(
    `FAIL local performance verification: ${error.code || error.name}${error.code && error.code !== 'ERR_ASSERTION' ? '' : `: ${error.message}`}`,
  );
  process.exitCode = 1;
});
