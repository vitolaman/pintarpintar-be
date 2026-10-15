// Real local HTTP, PostgreSQL and TLS SMTP checks. No shared DB or real inbox access.
// Usage after build: node scripts/verify/email-preferences.cjs <local-env> <harness-dir>
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync, mkdtempSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { Client } = require('pg');
const dotenv = require('dotenv');

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function main() {
  const local = dotenv.parse(readFileSync(process.argv[2]));
  const harness = process.argv[3];
  assert(harness, 'Pass the local test harness directory');
  const artifacts = mkdtempSync(join(tmpdir(), 'pp-email-verification-'));
  const database = `pp_email_flows_${process.pid}`;
  const admin = new Client({
    host: '127.0.0.1',
    port: Number(local.LOCAL_DB_PORT),
    user: local.LOCAL_DB_USERNAME,
    password: local.LOCAL_DB_PASSWORD,
    database: 'postgres',
  });
  let created = false;
  let app;
  let sink;
  let transport;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    const smtpPort = await reservePort();
    const messagesFile = join(artifacts, 'smtp-messages.jsonl');
    sink = spawn(
      process.execPath,
      [join(harness, 'smtp/smtp-sink.mjs'), String(smtpPort), messagesFile],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('SMTP sink startup timeout')),
        5000,
      );
      sink.stdout.once('data', () => {
        clearTimeout(timeout);
        resolve();
      });
      sink.once('error', reject);
      sink.once('exit', (code) =>
        reject(new Error(`SMTP sink exited ${code}`)),
      );
    });
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
      JWT_ADMIN_KEY: randomBytes(32).toString('hex'),
      MAIL_HOST: '127.0.0.1',
      MAIL_PORT: String(smtpPort),
      MAIL_USERNAME: 'fixture@example.test',
      MAIL_PASSWORD: randomBytes(16).toString('hex'),
      MAIL_SENDER: 'Fixture <fixture@example.test>',
      FRONTEND_URL: 'https://frontend.example.test',
      API_PUBLIC_URL: 'https://api.example.test',
    });
    // Explicitly trust the local fixture certificate; TLS and hostname checks remain enabled.
    transport = require('nodemailer').createTransport({
      host: '127.0.0.1',
      port: smtpPort,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
      tls: {
        ca: readFileSync(join(harness, 'smtp/cert.pem')),
        servername: 'localhost',
      },
    });
    await transport.verify();
    const { Test } = require('@nestjs/testing');
    const { ValidationPipe } = require('@nestjs/common');
    const { MailerService } = require('@nestjs-modules/mailer');
    const { DataSource } = require('typeorm');
    const { SchedulerRegistry } = require('@nestjs/schedule');
    const { JwtService } = require('@nestjs/jwt');
    const { AppModule } = require('../../dist/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailerService)
      .useValue({ sendMail: (mail) => transport.sendMail(mail) })
      .compile();
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
    const jwt = app.get(JwtService);
    const {
      EmailSenderService,
    } = require('../../dist/api/email/email-sender.service');
    const {
      queueEmails,
      guardEmailQueue,
    } = require('../../dist/api/email/email-queue');
    const {
      EMAIL_PREFERENCE_FIELDS,
    } = require('../../dist/api/notification-preferences/preference-fields');
    const sender = app.get(EmailSenderService);
    const keys = Object.keys(EMAIL_PREFERENCE_FIELDS);
    const checked = [];

    async function account(roles = {}) {
      const id = randomUUID();
      const email = `${id}@example.test`;
      await source.query(
        'INSERT INTO users (id,name,email,password_hash,is_mentor,is_merchant) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          id,
          'Fixture',
          email,
          randomBytes(32).toString('hex'),
          Boolean(roles.mentor),
          Boolean(roles.merchant),
        ],
      );
      return { id, email, token: jwt.sign({ id, tv: 0 }) };
    }
    async function request(actor, method, path, body, status = 200) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const json = await response.json();
      assert.equal(
        response.status,
        status,
        `${method} ${path}: ${JSON.stringify(json)}`,
      );
      return json;
    }
    const preferencePath = '/api/v1/profile/notification-preferences';
    const patch = (actor, values) =>
      request(actor, 'PATCH', preferencePath, values);
    async function drain() {
      let sent = 0;
      let discarded = 0;
      for (let iteration = 0; iteration < 20; iteration++) {
        const result = await sender.sendBatch();
        if (result.failed + result.retried !== 0) {
          const failures = await source.query(
            "SELECT kind,status,last_error FROM email_outbox WHERE status='failed' OR attempts>0",
          );
          assert.fail(
            `SMTP delivery must succeed: ${JSON.stringify(failures)}`,
          );
        }
        sent += result.sent;
        discarded += result.discarded;
        if (result.sent + result.discarded === 0) return { sent, discarded };
      }
      throw new Error('Outbox did not drain within the bounded batches');
    }
    async function outbox(dedupeKey) {
      return (
        await source.query(
          'SELECT kind,status,attempts,payload FROM email_outbox WHERE dedupe_key=$1',
          [dedupeKey],
        )
      )[0];
    }
    const actor = await account();
    assert.deepEqual(
      (await request(actor, 'GET', preferencePath)).data,
      Object.fromEntries(keys.map((key) => [key, true])),
    );
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT count(*) FROM user_notification_preferences',
          )
        )[0].count,
      ),
      0,
    );
    await request(null, 'GET', preferencePath, undefined, 401);
    await request(null, 'PATCH', preferencePath, {}, 401);
    for (const body of [
      { user_id: randomUUID() },
      { email_order_paid: null },
      { email_order_paid: 'false' },
      { email_weekly_report: false },
    ]) {
      await request(actor, 'PATCH', preferencePath, body, 400);
    }
    checked.push(
      'authenticated twelve-field API, virtual defaults, invalid inputs',
    );

    // All simultaneous first writes touch different switches; no row or value may be lost.
    await Promise.all(keys.map((key) => patch(actor, { [key]: false })));
    assert.deepEqual(
      (await request(actor, 'GET', preferencePath)).data,
      Object.fromEntries(keys.map((key) => [key, false])),
    );
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT count(*) FROM user_notification_preferences WHERE user_id=$1',
            [actor.id],
          )
        )[0].count,
      ),
      1,
    );
    const other = await account();
    assert.equal(
      (await request(other, 'GET', preferencePath)).data.email_order_paid,
      true,
    );
    const role = (
      await source.query(
        'SELECT is_mentor,is_merchant FROM users WHERE id=$1',
        [actor.id],
      )
    )[0];
    assert.deepEqual(role, { is_mentor: false, is_merchant: false });
    checked.push(
      'concurrent disjoint first writes, one row, account isolation, unchanged roles',
    );

    const storeForm = {
      store_name: `Fixture ${randomUUID().slice(0, 8)}`,
      store_description: 'Local verification',
      terms_accepted: true,
      business_type: 'individual',
      city: 'Bandung',
      public_phone: '081234567890',
      product_types: ['kelas', 'digital'],
    };
    const owner = await account();
    const merchant = (
      await request(owner, 'POST', '/api/v1/merchant/register', storeForm, 201)
    ).data;
    assert.equal(
      (await outbox(`merchant:${merchant.id}:registered`)).status,
      'pending',
    );
    await request(owner, 'POST', '/api/v1/merchant/register', storeForm, 409);
    assert.equal(
      Number(
        (
          await source.query(
            "SELECT count(*) FROM email_outbox WHERE kind='merchant_registered'",
          )
        )[0].count,
      ),
      1,
    );
    await patch(other, { email_merchant_registered: false });
    const quietMerchant = (
      await request(
        other,
        'POST',
        '/api/v1/merchant/register',
        { ...storeForm, store_name: `Quiet ${randomUUID().slice(0, 8)}` },
        201,
      )
    ).data;
    assert.equal(
      await outbox(`merchant:${quietMerchant.id}:registered`),
      undefined,
    );
    const legacyPath = '/api/v1/merchant/notification-preferences';
    await Promise.all([
      patch(owner, { email_new_sale: false }),
      request(owner, 'PATCH', legacyPath, {
        email_new_applicant: false,
        email_cashflow_success: false,
        email_weekly_report: false,
      }),
    ]);
    assert.equal(
      (await request(owner, 'GET', preferencePath)).data.email_new_sale,
      false,
    );
    const legacy = (await request(owner, 'GET', legacyPath)).data;
    assert.equal(legacy.email_new_sale, false);
    assert.equal(legacy.email_new_applicant, false);
    assert.equal(legacy.email_cashflow_success, false);
    assert.equal(legacy.email_weekly_report, false);
    assert.equal(Object.keys(legacy).length, 10);
    await request(actor, 'GET', legacyPath, undefined, 404);
    await drain();
    checked.push(
      'registration success/duplicate/opt-out, compatible merchant API, cross-route races',
    );

    const now = new Date().toISOString();
    const purchase = {
      order_number: 'ORD-20261015-0001',
      buyer_name: 'Fixture',
      items: [],
      discount_amount: 0,
      total_amount: 0,
      paid_at: now,
      payment_method: null,
    };
    const application = {
      applicant_name: 'Fixture',
      job_title: 'Fixture mentor',
      store_name: 'Fixture store',
    };
    const cashflow = {
      owner_name: 'Fixture',
      store_name: 'Fixture store',
      amount: 100000,
      fee_amount: 5000,
      destination: 'Fixture bank •••• 0001',
      requested_at: now,
    };
    const cases = [
      ['email_order_paid', 'order_paid', purchase],
      ['email_application_submitted', 'application_submitted', application],
      [
        'email_merchant_registered',
        'merchant_registered',
        { owner_name: 'Fixture', store_name: 'Fixture store' },
      ],
      [
        'email_pro_paid',
        'pro_paid',
        {
          transaction_number: 'PRO-20261015-0001',
          owner_name: 'Fixture',
          plan_name: 'Fixture Pro',
          duration_months: 1,
          total_amount: 0,
          paid_at: now,
          payment_method: null,
          pro_until: now.slice(0, 10),
        },
      ],
      [
        'email_interview_scheduled',
        'interview_scheduled',
        {
          ...application,
          interview_at: now,
          interview_url: null,
          rescheduled: true,
          previous_interview_at: now,
        },
      ],
      [
        'email_application_result',
        'application_accepted',
        { ...application, class_title: null },
      ],
      ['email_application_result', 'application_rejected', application],
      [
        'email_new_sale',
        'merchant_new_sale',
        {
          ...purchase,
          owner_name: 'Fixture',
          store_name: 'Fixture store',
          net_total: 0,
          settlement_date: null,
        },
      ],
      [
        'email_new_applicant',
        'merchant_new_applicant',
        { ...application, owner_name: 'Fixture', applied_at: now },
      ],
      [
        'email_cashflow_success',
        'merchant_balance_settled',
        { ...cashflow, order_count: 1, settled_at: now },
      ],
      ['email_cashflow_success', 'withdrawal_succeeded', cashflow],
      ...[
        ['learner', 'email_learner_announcement'],
        ['tutor', 'email_mentor_announcement'],
        ['merchant', 'email_merchant_announcement'],
      ].map(([audience, key]) => [
        key,
        'class_announcement',
        {
          recipient_name: 'Fixture',
          audience,
          class_title: 'Fixture class',
          author_name: 'Fixture author',
          title: 'Fixture announcement',
          excerpt: 'Fixture content',
        },
      ]),
    ];
    for (const [key, kind, payload] of cases) {
      for (const enabled of [false, true]) {
        await patch(actor, { [key]: enabled });
        const dedupeKey = `fixture:${kind}:${key}:${enabled}`;
        await source.transaction((manager) =>
          queueEmails(manager, [
            { kind, to: actor.email, userId: actor.id, dedupeKey, payload },
          ]),
        );
        assert.equal(
          (await outbox(dedupeKey))?.status,
          enabled ? 'pending' : undefined,
          `${kind} enqueue`,
        );
        const delivered = await drain();
        assert.equal(delivered.sent, enabled ? 1 : 0, `${kind} delivery`);
        if (enabled) assert.equal((await outbox(dedupeKey)).status, 'sent');
      }
    }
    checked.push(
      'all twelve switches, fourteen mapped event kinds/contexts, real TLS SMTP, future events after re-enable',
    );

    for (const state of ['pending', 'retry', 'lease-recovery']) {
      await patch(actor, { email_application_submitted: true });
      const dedupeKey = `fixture:delivery:${state}`;
      await source.transaction((manager) =>
        queueEmails(manager, [
          {
            kind: 'application_submitted',
            to: actor.email,
            userId: actor.id,
            dedupeKey,
            payload: application,
          },
        ]),
      );
      if (state !== 'pending')
        await source.query(
          "UPDATE email_outbox SET status=$1,attempts=2,next_attempt_at=now()-interval '1 minute' WHERE dedupe_key=$2",
          [state === 'retry' ? 'pending' : 'sending', dedupeKey],
        );
      await patch(actor, { email_application_submitted: false });
      assert.equal((await drain()).sent, 0);
      assert.equal((await outbox(dedupeKey)).status, 'discarded');
      await patch(actor, { email_application_submitted: true });
      assert.equal((await drain()).sent, 0);
    }
    const rolledBackKey = 'fixture:rolled-back';
    await assert.rejects(
      source.transaction(async (manager) => {
        await queueEmails(manager, [
          {
            kind: 'application_submitted',
            to: actor.email,
            userId: actor.id,
            dedupeKey: rolledBackKey,
            payload: application,
          },
        ]);
        throw new Error('fixture rollback');
      }),
      /fixture rollback/,
    );
    assert.equal(await outbox(rolledBackKey), undefined);
    await source.transaction(async (manager) => {
      await guardEmailQueue(manager, 'fixture failure', async () => {
        await manager.query(
          'SELECT * FROM intentionally_missing_fixture_table',
        );
      });
      assert.equal(
        (await manager.query('SELECT 1 AS preserved'))[0].preserved,
        1,
      );
    });
    checked.push(
      'pending/retry/lease opt-outs, no replay, rollback and savepoint isolation',
    );

    const {
      verifyBusinessFlows,
    } = require('./email-preferences-business-flows.cjs');
    await verifyBusinessFlows({
      app,
      source,
      account,
      request,
      patch,
      drain,
      outbox,
      actor,
      owner,
      merchant,
      now,
      checked,
    });

    for (const description of checked) console.log(`PASS ${description}`);
    const fixtureIds = {};
    for (const table of [
      'users',
      'merchants',
      'classes',
      'orders',
      'job_postings',
      'job_applications',
      'merchant_payouts',
      'pro_transactions',
      'discussion_threads',
      'email_outbox',
    ]) {
      fixtureIds[table] = (
        await source.query(`SELECT id FROM ${table} ORDER BY id`)
      ).map((row) => row.id);
    }
    console.log(`FIXTURES ${JSON.stringify({ database, ids: fixtureIds })}`);
    const repository = join(__dirname, '../..');
    const e2e = spawnSync(
      process.execPath,
      [
        join(repository, 'node_modules/jest/bin/jest.js'),
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
      ],
      {
        cwd: repository,
        env: process.env,
        encoding: 'utf8',
        timeout: 120000,
      },
    );
    if (e2e.status !== 0) {
      const classifications =
        e2e.stderr.match(
          /Jest encountered an unexpected token|SyntaxError: Unexpected token[^\n]*|Cannot use import statement outside a module|TypeError: request is not a function|TS\d+:|Test Suites:[^\n]*|Tests:[^\n]*/g,
        ) ?? [];
      console.error(classifications.join('\n'));
    }
    assert.equal(
      e2e.status,
      0,
      'Existing Jest e2e suite must pass against this isolated local database',
    );
    console.log(
      e2e.stderr
        .split('\n')
        .filter((line) => /^(Test Suites:|Tests:)/.test(line))
        .join('\n'),
    );
    const messages = existsSync(messagesFile)
      ? readFileSync(messagesFile, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(JSON.parse)
      : [];
    assert(
      messages.length > 0 && messages.every((message) => message.secure),
      'Every SMTP message must use TLS',
    );
    console.log(
      `PASS ${messages.length} synthetic SMTP messages, TLS verified`,
    );
  } finally {
    if (app) await app.close();
    if (transport) transport.close();
    if (sink) sink.kill('SIGTERM');
    if (created) await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(
    `FAIL local feature verification: ${error.code || error.name}${error.code && error.code !== 'ERR_ASSERTION' ? '' : `: ${error.message}`}`,
  );
  process.exitCode = 1;
});
