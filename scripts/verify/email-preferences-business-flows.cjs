const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function verifyBusinessFlows({
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
}) {
  const { Class } = require('../../dist/class/entities/class.entity');
  const { Order } = require('../../dist/api/order/entities/order.entity');
  const {
    OrderItem,
  } = require('../../dist/api/order/entities/order-item.entity');
  const {
    OrderPaymentService,
  } = require('../../dist/api/payment/order-payment.service');
  const payments = app.get(OrderPaymentService);
  const freeClass = await source.manager.save(Class, {
    merchant_id: merchant.id,
    title: 'Fixture free class',
    status: 'published',
    type: 'video',
    originalPrice: 0,
    discountedPrice: 0,
  });
  await patch(actor, { email_order_paid: false });
  await patch(owner, {
    email_new_sale: false,
    email_cashflow_success: false,
  });
  const freeOrder = (
    await request(
      actor,
      'POST',
      '/api/v1/orders',
      { items: [{ type: 'kelas', id: freeClass.id }] },
      201,
    )
  ).data;
  assert.equal(freeOrder.status, 'paid');
  assert.equal(await outbox(`order:${freeOrder.id}:paid`), undefined);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM enrollments WHERE user_id=$1 AND class_id=$2',
          [actor.id, freeClass.id],
        )
      )[0].count,
    ),
    1,
  );
  const paidClass = await source.manager.save(Class, {
    merchant_id: merchant.id,
    title: 'Fixture paid class',
    status: 'published',
    type: 'video',
    originalPrice: 100000,
    discountedPrice: 0,
  });
  const order = await source.manager.save(Order, {
    userId: actor.id,
    orderNumber: 'ORD-20261015-0002',
    totalAmount: '100000',
    discountAmount: '0',
    status: 'pending',
  });
  await source.manager.save(OrderItem, {
    orderId: order.id,
    classId: paidClass.id,
    priceAtPurchase: '100000',
    discountAmount: '0',
  });
  const result = {
    orderNumber: order.orderNumber,
    resultCode: '00',
    amount: '100000',
    reference: 'fixture-reference',
    paymentMethod: 'BC',
    settlementDate: now.slice(0, 10),
  };
  const outcomes = await Promise.all([
    payments.applyGatewayResult(result),
    payments.applyGatewayResult(result),
  ]);
  assert.deepEqual(outcomes.sort(), ['paid', 'unchanged']);
  assert.equal(await outbox(`order:${order.id}:paid`), undefined);
  assert.equal(
    await outbox(`order:${order.id}:sale:${merchant.id}`),
    undefined,
  );
  const wallet = async () =>
    (
      await source.query(
        'SELECT earning_balance,settled_balance,lifetime_earnings FROM merchant_wallets WHERE merchant_id=$1',
        [merchant.id],
      )
    )[0];
  assert.equal(Number((await wallet()).earning_balance), 100000);
  assert.equal(Number((await wallet()).lifetime_earnings), 100000);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM enrollments WHERE user_id=$1 AND class_id=$2',
          [actor.id, paidClass.id],
        )
      )[0].count,
    ),
    1,
  );
  await payments.settleDue();
  assert.equal(Number((await wallet()).settled_balance), 100000);
  assert.equal(await payments.settleDue(), 0);
  assert.equal(
    Number(
      (
        await source.query(
          "SELECT count(*) FROM email_outbox WHERE kind='merchant_balance_settled' AND recipient_user_id=$1",
          [owner.id],
        )
      )[0].count,
    ),
    0,
  );
  checked.push(
    'free/paid order fulfillment, duplicate concurrent callback, grants and wallet settlement with emails disabled',
  );

  const { ProPlan } = require('../../dist/api/pro/entities/pro-plan.entity');
  const {
    ProTransaction,
  } = require('../../dist/api/pro/entities/pro-transaction.entity');
  const {
    ProPaymentService,
  } = require('../../dist/api/payment/pro-payment.service');
  const plan = await source.manager.save(ProPlan, {
    code: `fixture-${randomUUID().slice(0, 8)}`,
    name: 'Fixture Pro',
    durationMonths: 1,
    price: '100000',
    isOffered: true,
  });
  const pro = await source.manager.save(ProTransaction, {
    userId: owner.id,
    merchantId: merchant.id,
    planId: plan.id,
    transactionNumber: 'PRO-20261015-0002',
    planName: plan.name,
    durationMonths: 1,
    totalAmount: '100000',
    discountAmount: '0',
    status: 'pending',
  });
  await patch(owner, { email_pro_paid: false });
  const proResult = {
    transactionNumber: pro.transactionNumber,
    resultCode: '00',
    amount: '100000',
    reference: 'fixture-pro-reference',
    paymentMethod: 'BC',
    settlementDate: null,
  };
  const proPayments = app.get(ProPaymentService);
  assert.equal(await proPayments.applyGatewayResult(proResult), 'paid');
  assert.equal(await proPayments.applyGatewayResult(proResult), 'unchanged');
  assert.equal(await outbox(`pro:${pro.id}:paid`), undefined);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM merchant_pro_periods WHERE merchant_id=$1 AND plan_id=$2',
          [merchant.id, plan.id],
        )
      )[0].count,
    ),
    1,
  );
  checked.push(
    'Pro activation and duplicate handling with success email disabled',
  );

  const {
    MerchantPayout,
  } = require('../../dist/api/merchant/entities/merchant-payout.entity');
  const {
    queueWithdrawalOutcomeEmails,
  } = require('../../dist/api/email/events/merchant-emails');
  const successfulPayout = await source.manager.save(MerchantPayout, {
    merchantId: merchant.id,
    amount: '50000',
    feeAmount: '5000',
    status: 'success',
    destinationBankAccount: 'Fixture bank •••• 0001',
  });
  const beforeOutcome = await wallet();
  assert.equal(
    await source.transaction((manager) =>
      queueWithdrawalOutcomeEmails(manager),
    ),
    1,
  );
  assert.equal(
    (await outbox(`payout:${successfulPayout.id}:success`)).status,
    'discarded',
  );
  await patch(owner, { email_cashflow_success: true });
  assert.equal(
    await source.transaction((manager) =>
      queueWithdrawalOutcomeEmails(manager),
    ),
    0,
  );
  const failedPayout = await source.manager.save(MerchantPayout, {
    merchantId: merchant.id,
    amount: '50000',
    feeAmount: '5000',
    status: 'failed',
    destinationBankAccount: 'Fixture bank •••• 0001',
  });
  await patch(owner, { email_cashflow_success: false });
  assert.equal(
    await source.transaction((manager) =>
      queueWithdrawalOutcomeEmails(manager),
    ),
    1,
  );
  assert.equal(
    (await outbox(`payout:${failedPayout.id}:failed`)).status,
    'pending',
  );
  assert.equal((await drain()).sent, 1);
  assert.deepEqual(await wallet(), beforeOutcome);
  checked.push(
    'polled success suppression, re-enable without replay, unchanged withdrawal-failure delivery and wallet',
  );

  const {
    JobPosting,
  } = require('../../dist/api/recruitment/entities/job-posting.entity');
  const {
    FileAsset,
  } = require('../../dist/api/profile/entities/file-asset.entity');
  const applicant = await account();
  const cv = await source.manager.save(FileAsset, {
    uploadedByUserId: applicant.id,
    storageProvider: 's3',
    objectKey: `fixture/${randomUUID()}.pdf`,
    originalFilename: 'fixture-cv.pdf',
    mimeType: 'application/pdf',
    sizeBytes: '100',
    visibility: 'pending',
    status: 'active',
  });
  await patch(applicant, {
    email_application_submitted: false,
    email_interview_scheduled: false,
    email_application_result: false,
  });
  for (const decision of ['accept', 'reject']) {
    const job = await source.manager.save(JobPosting, {
      merchantId: merchant.id,
      title: `Fixture ${decision}`,
      category: 'Fixture skill',
      contractType: 'Part-Time',
      workType: 'Remote',
      requirements: 'Fixture requirements',
      status: 'active',
    });
    const applicationRecord = (
      await request(
        applicant,
        'POST',
        `/api/v1/job-postings/${job.id}/apply`,
        {
          name: 'Fixture applicant',
          email: 'different-contact@example.test',
          phone: '081234567890',
          cv_asset_id: cv.id,
        },
        201,
      )
    ).data;
    assert.equal(
      await outbox(`application:${applicationRecord.id}:submitted`),
      undefined,
    );
    await request(
      owner,
      'POST',
      `/api/v1/merchant/job-applications/${applicationRecord.id}/schedule-interview`,
      {
        interview_at: new Date(Date.now() + 86400000).toISOString(),
        interview_url: 'https://meet.example.test/fixture',
      },
    );
    await request(
      owner,
      'POST',
      `/api/v1/merchant/job-applications/${applicationRecord.id}/schedule-interview`,
      {
        interview_at: new Date(Date.now() + 172800000).toISOString(),
        interview_url: 'https://meet.example.test/reschedule',
      },
    );
    await request(
      owner,
      'POST',
      `/api/v1/merchant/job-applications/${applicationRecord.id}/${decision}`,
      {},
    );
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT count(*) FROM email_outbox WHERE dedupe_key LIKE $1',
            [`application:${applicationRecord.id}:%`],
          )
        )[0].count,
      ),
      0,
    );
    const state = (
      await source.query('SELECT status FROM job_applications WHERE id=$1', [
        applicationRecord.id,
      ])
    )[0].status;
    assert.equal(state, decision === 'accept' ? 'accepted' : 'rejected');
  }
  checked.push(
    'real application submission/interview/reschedule/accept/reject, different contact email, normal state transitions while opted out',
  );

  const { Mentor } = require('../../dist/api/mentor/entities/mentor.entity');
  const {
    ClassMentor,
  } = require('../../dist/class/entities/class-mentor.entity');
  const { Enrollment } = require('../../dist/class/entities/enrollment.entity');
  const tutor = await account({ mentor: true });
  const mentor = await source.manager.save(Mentor, {
    userId: tutor.id,
    status: 'active',
  });
  await source.manager.save(ClassMentor, {
    class_id: paidClass.id,
    mentor_id: mentor.id,
    role: 'lead',
  });
  await source.manager.save(Enrollment, {
    user_id: owner.id,
    class_id: paidClass.id,
  });
  await patch(owner, {
    email_merchant_announcement: false,
    email_learner_announcement: true,
  });
  await patch(actor, { email_learner_announcement: true });
  const thread = (
    await request(
      tutor,
      'POST',
      '/api/v1/discussions/threads',
      {
        class_id: paidClass.id,
        title: 'Fixture announcement',
        content: 'Fixture details',
        badge: 'Pengumuman',
      },
      201,
    )
  ).data;
  assert.equal(
    await outbox(`announcement:${thread.id}:${owner.id}`),
    undefined,
  );
  assert.equal(
    await outbox(`announcement:${thread.id}:${tutor.id}`),
    undefined,
  );
  assert.equal(
    (await outbox(`announcement:${thread.id}:${actor.id}`)).status,
    'pending',
  );
  await source.manager.save(Enrollment, {
    user_id: tutor.id,
    class_id: freeClass.id,
  });
  await patch(tutor, {
    email_mentor_announcement: false,
    email_learner_announcement: true,
  });
  const otherThread = (
    await request(
      owner,
      'POST',
      '/api/v1/discussions/threads',
      {
        class_id: freeClass.id,
        title: 'Fixture learner context',
        content: 'Fixture details',
        badge: 'Pengumuman',
      },
      201,
    )
  ).data;
  assert.equal(
    (await outbox(`announcement:${otherThread.id}:${tutor.id}`)).payload
      .audience,
    'learner',
  );
  const discussion = (
    await request(
      owner,
      'POST',
      '/api/v1/discussions/threads',
      {
        class_id: freeClass.id,
        title: 'Fixture discussion',
        content: 'Fixture details',
        badge: 'Diskusi',
      },
      201,
    )
  ).data;
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM email_outbox WHERE dedupe_key LIKE $1',
          [`announcement:${discussion.id}:%`],
        )
      )[0].count,
    ),
    0,
  );
  await drain();
  checked.push(
    'real announcement API, author exclusion, owner-over-learner priority, tutor-as-learner context and other badges',
  );
}

module.exports = { verifyBusinessFlows };
