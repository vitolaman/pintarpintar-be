import { emailKinds, EmailPayloads, renderEmail } from './index';

const FRONTEND = 'https://pintarpintar.id';
const order = {
  order_number: 'ORD-20261005-0012',
  buyer_name: 'Ayu Lestari',
  items: [
    {
      title: 'Template RAB Excel',
      type: 'digital' as const,
      merchant: 'Studio Sipil',
      amount: 119000,
      instructions: 'Unduh file di Portal Saya\nBaca sheet Petunjuk',
    },
    {
      title: 'Kelas Arduino',
      type: 'kelas' as const,
      merchant: 'Kode Kampus',
      amount: 79000,
      instructions: null,
    },
  ],
  discount_amount: 25000,
  total_amount: 173000,
};
const application = {
  applicant_name: 'Fajar',
  job_title: 'Mentor AutoCAD',
  store_name: 'Studio Sipil',
};
const meeting = {
  learner_name: 'Ayu',
  class_title: 'Bootcamp Manajemen Proyek',
  meeting_title: 'Sesi 3: Kurva S',
  starts_at: '2026-10-12T12:00:00Z',
  previous_starts_at: '2026-10-10T12:00:00Z',
  duration_minutes: 90,
  live_url: 'https://zoom.us/j/1',
};

// One sample per kind, each with a value that must appear in both parts.
const SAMPLES: { [K in keyof EmailPayloads]: [EmailPayloads[K], string] } = {
  order_awaiting_payment: [
    {
      ...order,
      expires_at: '2026-10-05T08:30:00Z',
      payment_url: 'https://pay.example/x',
    },
    '5 Oktober 2026, 15.30 WIB',
  ],
  order_paid: [
    { ...order, paid_at: '2026-10-05T07:41:00Z', payment_method: 'BC' },
    'BCA Virtual Account',
  ],
  order_expired: [order, 'ORD-20261005-0012'],
  order_failed: [order, 'ORD-20261005-0012'],
  merchant_new_sale: [
    {
      order_number: 'ORD-20261005-0012',
      buyer_name: 'Ayu Lestari',
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      paid_at: '2026-10-05T07:41:00Z',
      items: [{ title: 'Template RAB Excel', type: 'digital', amount: 111360 }],
      net_total: 111360,
      settlement_date: '2026-10-08',
    },
    '8 Oktober 2026',
  ],
  merchant_level_result: [
    {
      owner_name: 'Dimas',
      store_name: 'Rupa Kreatif',
      month: '2026-09',
      revenue: 3250000,
      level_before: 'basic',
      level_after: 'silver',
    },
    'Rp 3.250.000',
  ],
  merchant_inactivity_warning: [
    {
      owner_name: 'Dimas',
      store_name: 'Rupa Kreatif',
      quiet_months: ['2026-08', '2026-09'],
      deadline_month: '2026-10',
    },
    'Oktober 2026',
  ],
  merchant_items_removed: [
    { owner_name: 'Dimas', store_name: 'Rupa Kreatif', removed_count: 7 },
    '7',
  ],
  withdrawal_requested: [
    {
      owner_name: 'Sari',
      store_name: 'Akademi MP',
      amount: 1500000,
      fee_amount: 5000,
      bank_name: 'BCA',
      masked_account_number: '•••• 7890',
      account_holder_name: 'Sari Handayani',
      requested_at: '2026-10-05T03:12:00Z',
    },
    'Rp 1.495.000',
  ],
  payout_account_changed: [
    {
      owner_name: 'Sari',
      store_name: 'Akademi MP',
      action: 'added',
      bank_name: 'BCA',
      masked_account_number: '•••• 7890',
      account_holder_name: 'Sari Handayani',
      changed_at: '2026-10-05T03:05:00Z',
    },
    '•••• 7890',
  ],
  password_changed: [
    {
      user_name: 'Ayu',
      email: 'ayu@example.test',
      changed_at: '2026-10-05T02:20:00Z',
    },
    'ayu@example.test',
  ],
  password_reset: [
    {
      user_name: 'Ayu',
      reset_token: 'abc-DEF_123',
      expires_at: '2026-10-05T08:30:00Z',
    },
    '5 Oktober 2026, 15.30 WIB',
  ],
  application_submitted: [application, 'Mentor AutoCAD'],
  interview_scheduled: [
    {
      ...application,
      interview_at: '2026-10-08T03:00:00Z',
      interview_url: 'https://meet.example/x',
      rescheduled: false,
    },
    '8 Oktober 2026, 10.00 WIB',
  ],
  application_accepted: [
    { ...application, class_title: 'AutoCAD Sipil' },
    'AutoCAD Sipil',
  ],
  application_rejected: [application, 'Mentor AutoCAD'],
  meeting_created: [meeting, '12 Oktober 2026, 19.00 WIB'],
  meeting_updated: [meeting, '10 Oktober 2026, 19.00 WIB'],
  meeting_cancelled: [meeting, 'Sesi 3: Kurva S'],
  meeting_reminder: [meeting, '12 Oktober 2026, 19.00 WIB'],
  meeting_mentor_reminder: [meeting, '12 Oktober 2026, 19.00 WIB'],
  submission_graded: [
    {
      learner_name: 'Ayu',
      class_title: 'Bootcamp',
      assignment_title: 'Kurva S Gudang',
      score: 86,
      max_score: null,
      graded_at: '2026-10-05T09:00:00Z',
      feedback: 'Bagus.\nPerbaiki durasi atap.',
    },
    'Perbaiki durasi atap.',
  ],
  certificate_issued: [
    {
      learner_name: 'Ayu',
      class_title: 'Bootcamp',
      certificate_number: 'PP-CERT-2026-0042',
      store_name: 'Akademi MP',
      issued_at: '2026-10-05T10:00:00Z',
    },
    'PP-CERT-2026-0042',
  ],
};

describe('email templates', () => {
  it('has a sample for every kind', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...emailKinds].sort());
  });

  it.each(emailKinds)(
    '%s renders the shared layout with its data in both parts',
    (kind) => {
      const [payload, value] = SAMPLES[kind] as [never, string];
      const email = renderEmail(kind, payload, FRONTEND);

      expect(email.subject.trim()).not.toBe('');
      expect(email.html).toContain(`src="${FRONTEND}/logo.png"`);
      expect(email.html).toContain(
        'Email ini dikirim otomatis oleh Pintar Pintar',
      );
      expect(email.html).toContain(value);
      expect(email.text).toContain(value);
      expect(email.text).not.toMatch(/<[a-z]|&amp;|&lt;/);
    },
  );

  it('shows merchant instructions only under items that have them', () => {
    const [payload] = SAMPLES.order_paid;
    const email = renderEmail('order_paid', payload, FRONTEND);

    expect(email.html).toContain('Instruksi dari merchant');
    expect(email.html).toContain('Template RAB Excel · Studio Sipil');
    expect(email.html).toContain(
      'Unduh file di Portal Saya<br>Baca sheet Petunjuk',
    );
    expect(email.html).not.toContain('Kelas Arduino · Kode Kampus');
    expect(email.text).toContain(
      'Template RAB Excel · Studio Sipil\nUnduh file di Portal Saya',
    );
    expect(email.html).toContain(`href="${FRONTEND}/portal-saya"`);
  });

  it('leaves the instruction section out when no item has instructions', () => {
    const [payload] = SAMPLES.order_paid;
    const email = renderEmail(
      'order_paid',
      { ...payload, items: [{ ...payload.items[1] }] },
      FRONTEND,
    );
    expect(email.html).not.toContain('Instruksi dari merchant');
  });

  it('escapes merchant and user text', () => {
    const [payload] = SAMPLES.order_paid;
    const email = renderEmail(
      'order_paid',
      {
        ...payload,
        buyer_name: '<img src=x onerror=alert(1)>',
        items: [
          {
            ...payload.items[0],
            instructions: '<script>alert(1)</script>\nBaris 2',
          },
        ],
      },
      FRONTEND,
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt;<br>Baris 2',
    );
    expect(email.text).toContain('<script>alert(1)</script>\nBaris 2');
  });

  it('names a level change in its direction', () => {
    const [payload] = SAMPLES.merchant_level_result;
    const render = (before: string, after: string) =>
      renderEmail(
        'merchant_level_result',
        { ...payload, level_before: before, level_after: after } as never,
        FRONTEND,
      ).text;
    expect(render('basic', 'silver')).toContain('naik ke Silver');
    expect(render('gold', 'silver')).toContain('turun ke Silver');
    expect(render('gold', 'gold')).toContain('tetap Gold');
    expect(render('basic', 'silver')).toContain('5 GB');
  });

  it('labels a free order as Gratis and a rescheduled interview as changed', () => {
    const [paid] = SAMPLES.order_paid;
    expect(
      renderEmail('order_paid', { ...paid, payment_method: null }, FRONTEND)
        .text,
    ).toContain('Metode pembayaran: Gratis');
    const [interview] = SAMPLES.interview_scheduled;
    expect(
      renderEmail(
        'interview_scheduled',
        { ...interview, rescheduled: true },
        FRONTEND,
      ).subject,
    ).toBe('Jadwal wawancara diubah: Mentor AutoCAD');
  });

  it('links the reset email to the reset page with its token', () => {
    const [payload] = SAMPLES.password_reset;
    const email = renderEmail('password_reset', payload, FRONTEND);
    expect(email.html).toContain(
      `href="${FRONTEND}/reset-password?token=abc-DEF_123"`,
    );
    expect(email.text).toContain(
      `Atur ulang kata sandi: ${FRONTEND}/reset-password?token=abc-DEF_123`,
    );
  });

  it('refuses to render a reset email whose token was removed', () => {
    const [payload] = SAMPLES.password_reset;
    expect(() =>
      renderEmail(
        'password_reset',
        { ...payload, reset_token: undefined },
        FRONTEND,
      ),
    ).toThrow('the reset token was already removed');
  });

  it('words the password notice for a reset, with a sign-in button', () => {
    const [payload] = SAMPLES.password_changed;
    const email = renderEmail(
      'password_changed',
      { ...payload, via_reset: true },
      FRONTEND,
    );
    expect(email.text).toContain('diatur ulang lewat tautan email');
    expect(email.text).toContain('dikeluarkan dari semua perangkat.');
    expect(email.text).toContain(`Masuk: ${FRONTEND}/login`);
    expect(renderEmail('password_changed', payload, FRONTEND).text).toContain(
      'semua perangkat lain',
    );
  });

  it('reminds learners with the join link, or Portal Saya without one', () => {
    const [payload] = SAMPLES.meeting_reminder;
    const withLink = renderEmail('meeting_reminder', payload, FRONTEND);
    expect(withLink.subject).toBe('Sesi dimulai 1 jam lagi: Sesi 3: Kurva S');
    expect(withLink.text).toContain('Gabung sesi: https://zoom.us/j/1');
    expect(
      renderEmail('meeting_reminder', { ...payload, live_url: null }, FRONTEND)
        .text,
    ).toContain(`Buka Portal Saya: ${FRONTEND}/portal-saya`);
  });

  it('reminds the mentor with mentor wording and the dashboard fallback', () => {
    const [payload] = SAMPLES.meeting_mentor_reminder;
    const email = renderEmail('meeting_mentor_reminder', payload, FRONTEND);
    expect(email.subject).toBe('Kamu mengajar 1 jam lagi: Sesi 3: Kurva S');
    expect(email.text).toContain('Kamu dijadwalkan mengajar');
    expect(
      renderEmail(
        'meeting_mentor_reminder',
        { ...payload, live_url: null },
        FRONTEND,
      ).text,
    ).toContain(`Buka dashboard mentor: ${FRONTEND}/mentor/dashboard`);
  });

  it('gives a cancelled meeting no join button', () => {
    const [payload] = SAMPLES.meeting_cancelled;
    const email = renderEmail('meeting_cancelled', payload, FRONTEND);
    expect(email.html).not.toContain('Gabung sesi');
    expect(email.html).not.toContain('https://zoom.us/j/1');
  });
});
