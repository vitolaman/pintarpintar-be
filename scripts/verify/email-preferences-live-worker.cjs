// Invoked only with explicit owner approval for the exact account/outbox scope.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { renderEmail } = require('../../dist/api/email/templates');

function cases(now) {
  const purchase = {
    order_number: 'LIVE-EMAIL-TEST-NO-ORDER',
    buyer_name: 'Uji Notifikasi',
    items: [],
    discount_amount: 0,
    total_amount: 0,
    paid_at: now,
    payment_method: null,
  };
  const application = {
    applicant_name: 'Uji Notifikasi',
    job_title: 'Uji email, bukan lamaran',
    store_name: 'Uji Notifikasi',
  };
  const cashflow = {
    owner_name: 'Uji Notifikasi',
    store_name: 'Uji Notifikasi',
    amount: 0,
    fee_amount: 0,
    destination: 'Uji email, bukan transfer',
    requested_at: now,
  };
  return [
    ['email_order_paid', 'order_paid', purchase],
    ['email_application_submitted', 'application_submitted', application],
    [
      'email_merchant_registered',
      'merchant_registered',
      { owner_name: 'Uji Notifikasi', store_name: 'Uji Notifikasi' },
    ],
    [
      'email_pro_paid',
      'pro_paid',
      {
        transaction_number: 'LIVE-EMAIL-TEST-NO-PRO',
        owner_name: 'Uji Notifikasi',
        plan_name: 'Uji email, bukan aktivasi',
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
        owner_name: 'Uji Notifikasi',
        store_name: 'Uji Notifikasi',
        net_total: 0,
        settlement_date: null,
      },
    ],
    [
      'email_new_applicant',
      'merchant_new_applicant',
      { ...application, owner_name: 'Uji Notifikasi', applied_at: now },
    ],
    [
      'email_cashflow_success',
      'merchant_balance_settled',
      { ...cashflow, order_count: 0, settled_at: now },
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
        recipient_name: 'Uji Notifikasi',
        audience,
        class_title: 'Uji email, bukan kelas',
        author_name: 'Uji Notifikasi',
        title: 'Uji Notifikasi',
        excerpt: 'Uji email, bukan pengumuman kelas.',
      },
    ]),
  ];
}

async function verifyEmailWorker(context) {
  const {
    connection,
    db,
    account,
    email,
    patch,
    snapshot,
    setRestoreSafe,
    progress,
  } = context;
  const prefix = `live-email-preferences:${randomUUID()}:`;
  const mapped = cases(new Date().toISOString());
  assert.equal(mapped.length, 14);
  assert.equal(new Set(mapped.map((row) => row[0])).size, 12);
  const rows = mapped.map(([key, kind, payload], index) => ({
    id: randomUUID(),
    key,
    kind,
    payload,
    dedupe_key: prefix + index,
    status: index === 2 ? 'sending' : 'pending',
    attempts: index === 1 ? 2 : index === 2 ? 1 : 0,
  }));
  const enabledId = randomUUID();
  const ids = [...rows.map((row) => row.id), enabledId];
  progress({
    fixture_manifest: { prefix, email_outbox_ids: ids },
    account_scope: 'owner-approved test account only',
  });
  for (const row of rows)
    renderEmail(row.kind, row.payload, {
      frontend: 'https://pintarpintar.id',
      api: 'https://api.pintarpintar.id',
    });
  const writer = new Client({
    ...connection,
    options: '-c statement_timeout=10000 -c lock_timeout=3000 -c timezone=UTC',
    application_name: 'owner-approved-isolated-email-outbox-fixtures',
  });
  let inserted = false;
  let cleaned = false;
  const inspect = async (selected) =>
    (
      await db.query(
        `SELECT id, kind, status, attempts, sent_at, last_error IS NOT NULL AS has_error,
     expires_at > now() AS unexpired
     FROM email_outbox WHERE recipient_user_id = $1 AND id = ANY($2::uuid[])
       AND dedupe_key LIKE $3 ORDER BY id`,
        [account.id, selected, prefix + '%'],
      )
    ).rows;
  async function waitFor(selected, status) {
    const deadline = Date.now() + 120000;
    let nextProgress = 0;
    while (Date.now() < deadline) {
      const observed = await inspect(selected);
      assert.equal(observed.length, selected.length);
      if (observed.every((row) => row.status === status)) return observed;
      if (
        observed.some(
          (row) =>
            ['failed', 'sent', 'discarded'].includes(row.status) &&
            row.status !== status,
        )
      ) {
        progress({
          worker_unexpected_statuses: observed.map((row) => ({
            id: row.id,
            status: row.status,
            attempts: row.attempts,
          })),
        });
        throw new Error('Unexpected worker terminal outcome');
      }
      if (Date.now() >= nextProgress) {
        progress({
          worker_waiting_for: status,
          terminal_count: observed.filter((row) => row.status === status)
            .length,
          total: selected.length,
        });
        nextProgress = Date.now() + 10000;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Deployed email worker observation timed out');
  }
  try {
    await writer.connect();
    assert.deepEqual(
      await patch(
        Object.fromEntries(Object.keys(snapshot).map((key) => [key, false])),
      ),
      Object.fromEntries(Object.keys(snapshot).map((key) => [key, false])),
    );
    setRestoreSafe(false);
    inserted = true;
    await writer.query(
      `INSERT INTO email_outbox
       (id, kind, recipient_email, recipient_user_id, dedupe_key, payload, status, attempts, next_attempt_at, expires_at)
       SELECT x.id::uuid, x.kind, $2, $3::uuid, x.dedupe_key, x.payload,
              x.status, x.attempts, now() - interval '1 second', now() + interval '15 minutes'
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, kind text, dedupe_key text, payload jsonb, status text, attempts int)`,
      [JSON.stringify(rows), email, account.id],
    );
    const discarded = await waitFor(
      rows.map((row) => row.id),
      'discarded',
    );
    for (const row of discarded) {
      assert.equal(
        row.attempts,
        rows.find((original) => original.id === row.id).attempts,
      );
      assert.equal(row.sent_at, null);
      assert.equal(row.has_error, false);
      assert.equal(row.unexpired, true);
    }
    setRestoreSafe(true);
    progress({
      worker_suppression: 'PASS',
      cases: 14,
      switches: 12,
      pending_retry_recovered_lease: true,
    });
    await patch(
      Object.fromEntries(Object.keys(snapshot).map((key) => [key, true])),
    );
    // Observe one more 30-second cron cycle; discarded records must not replay.
    await new Promise((resolve) => setTimeout(resolve, 35000));
    const afterEnable = await inspect(rows.map((row) => row.id));
    assert(
      afterEnable.every(
        (row) => row.status === 'discarded' && row.sent_at === null,
      ),
    );
    progress({ worker_reenable_no_replay: 'PASS' });
    await writer.query(
      `INSERT INTO email_outbox
       (id, kind, recipient_email, recipient_user_id, dedupe_key, payload, expires_at)
       VALUES ($1, 'merchant_registered', $2, $3, $4, $5::jsonb, now() + interval '15 minutes')`,
      [
        enabledId,
        email,
        account.id,
        prefix + 'enabled-registration',
        JSON.stringify({
          owner_name: account.name,
          store_name: account.store_name,
        }),
      ],
    );
    const [sent] = await waitFor([enabledId], 'sent');
    assert.equal(sent.attempts, 1);
    assert(sent.sent_at);
    assert.equal(sent.has_error, false);
    progress({
      worker_enabled_registration: 'PASS',
      sent_at: sent.sent_at,
      attempts: 1,
    });
    return {
      suppressed: 14,
      mapped_switches: 12,
      enabled_sent: 1,
      no_replay: true,
      enabled_sent_at: sent.sent_at,
      pending_retry_recovered_lease: true,
      fixture_manifest: { prefix, email_outbox_ids: ids },
      cleanup: 'Exact fixture rows removed in finally',
      inbox_receipt: 'Awaiting owner confirmation',
    };
  } finally {
    if (inserted) {
      const removed = await writer.query(
        `DELETE FROM email_outbox WHERE recipient_user_id = $1 AND id = ANY($2::uuid[])
         AND dedupe_key LIKE $3 RETURNING id, status`,
        [account.id, ids, prefix + '%'],
      );
      cleaned = true;
      const wasInFlight = removed.rows.some((row) => row.status === 'sending');
      if (wasInFlight) {
        // Do not re-enable switches while an unobserved claimed test may still send.
        setRestoreSafe(false);
        progress({
          safety_action:
            'Settings left off: an unexpected test claim was still in flight; owner follow-up required',
        });
      } else {
        setRestoreSafe(true);
      }
      assert.equal((await inspect(ids)).length, 0);
      progress({
        exact_fixture_cleanup: 'PASS',
        removed_rows: removed.rowCount,
      });
    }
    await writer.end();
    if (inserted) assert(cleaned);
  }
}

module.exports = { verifyEmailWorker, cases };
