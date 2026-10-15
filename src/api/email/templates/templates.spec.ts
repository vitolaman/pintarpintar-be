import { emailKinds, EmailPayloads, renderEmail } from './index';
import { weeklyChange } from './merchant-weekly-report.template';

const FRONTEND = 'https://pintarpintar.id';
const URLS = { frontend: FRONTEND, api: 'https://api.pintarpintar.id' };
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

const proPurchase = {
  transaction_number: 'PRO-20261013-0001',
  owner_name: 'Bambang',
  plan_name: 'Pro 3 Bulan',
  duration_months: 3,
  total_amount: 297000,
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
  merchant_registered: [
    { owner_name: 'Bambang', store_name: 'Studio Sipil' },
    'Studio Sipil',
  ],
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
  merchant_weekly_report: [
    {
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      week_start: '2026-09-28',
      week_end: '2026-10-04',
      revenue: 1245000,
      previous_revenue: 980000,
      transactions: 9,
      buyers: 8,
      top_items: [
        { title: 'Template RAB', type: 'digital', amount: 595000, sold: 5 },
        {
          title: 'Bootcamp Estimasi',
          type: 'bootcamp',
          amount: 450000,
          sold: 1,
        },
      ],
      new_reviews: 3,
      average_rating: 4.7,
      withdrawable_balance: 3120000,
    },
    'naik 27% dari minggu lalu (Rp 980.000)',
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
  merchant_balance_settled: [
    {
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      amount: 200000,
      order_count: 2,
      settled_at: '2026-10-08T01:00:00Z',
    },
    'Rp 200.000',
  ],
  withdrawal_succeeded: [
    {
      owner_name: 'Sari',
      store_name: 'Akademi MP',
      amount: 1500000,
      fee_amount: 5000,
      destination: 'BCA •••• 7890 a.n. Sari Handayani',
      requested_at: '2026-10-05T03:12:00Z',
    },
    'Rp 1.495.000',
  ],
  withdrawal_failed: [
    {
      owner_name: 'Sari',
      store_name: 'Akademi MP',
      amount: 1500000,
      fee_amount: 5000,
      destination: 'BCA •••• 7890 a.n. Sari Handayani',
      requested_at: '2026-10-05T03:12:00Z',
    },
    'BCA •••• 7890 a.n. Sari Handayani',
  ],
  merchant_new_applicant: [
    {
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      applicant_name: 'Fajar',
      job_title: 'Mentor AutoCAD',
      applied_at: '2026-10-08T02:15:00Z',
    },
    '8 Oktober 2026, 09.15 WIB',
  ],
  pro_expiring: [
    {
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      end_date: '2026-10-31',
    },
    '31 Oktober 2026',
  ],
  pro_not_renewed: [
    {
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      end_date: '2026-11-07',
    },
    '7 November 2026',
  ],
  pro_ended: [
    {
      owner_name: 'Bambang',
      store_name: 'Studio Sipil',
      end_date: '2026-11-07',
    },
    'tidak berlaku lagi',
  ],
  pro_awaiting_payment: [
    {
      ...proPurchase,
      expires_at: '2026-10-13T04:00:00Z',
      payment_url: 'https://pay.example/pro',
    },
    '13 Oktober 2026, 11.00 WIB',
  ],
  pro_paid: [
    {
      ...proPurchase,
      paid_at: '2026-10-13T03:00:00Z',
      payment_method: 'NQ',
      pro_until: '2027-01-13',
    },
    '13 Januari 2027',
  ],
  pro_failed: [proPurchase, 'PRO-20261013-0001'],
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
  class_announcement: [
    {
      recipient_name: 'Ayu',
      audience: 'learner',
      class_title: 'AutoCAD Dasar',
      author_name: 'Studio Sipil',
      title: 'Jadwal ujian akhir',
      excerpt: 'Ujian akhir dimulai Senin pukul 19.00 WIB.',
    },
    'Jadwal ujian akhir',
  ],
  class_tutor_assigned: [
    {
      mentor_name: 'Rexi',
      class_title: 'AutoCAD Dasar',
      store_name: 'Studio Sipil',
      role: 'assistant',
    },
    'Asisten Tutor',
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
      const email = renderEmail(kind, payload, URLS);

      expect(email.subject.trim()).not.toBe('');
      expect(email.html).toContain(
        'src="https://api.pintarpintar.id/email-assets/logo-white.png"',
      );
      expect(email.html).toContain(
        '<meta name="color-scheme" content="light">',
      );
      expect(email.html).toContain('bgcolor="#2D78F7"');
      expect(email.html).toContain(
        'Email ini dikirim otomatis oleh Pintar Pintar',
      );
      expect(email.html).toContain(value);
      expect(email.text).toContain(value);
      expect(email.text).not.toMatch(/<[a-z]|&amp;|&lt;/);
    },
  );

  it('words the merchant sale as the payment-received notice with a dashboard button', () => {
    const [payload] = SAMPLES.merchant_new_sale;
    const email = renderEmail(
      'merchant_new_sale',
      {
        ...payload,
        items: [
          ...payload.items,
          { title: 'Kelas Revit', type: 'kelas', amount: 200000 },
        ],
        net_total: 311360,
      },
      URLS,
    );

    expect(email.subject).toBe('Pembayaran baru diterima');
    expect(email.text).toContain(
      'Pembayaran berhasil diterima sebesar Rp 311.360 pada pembelian produk Template RAB Excel, Kelas Revit. Silahkan cek riwayat transaksi pada dashboard merchant.',
    );
    expect(email.html).toContain(`href="${FRONTEND}/merchant/dashboard"`);
    expect(email.text).toContain('Buka Dashboard Merchant');
  });

  it('never promises a refund to the balance when a withdrawal fails', () => {
    const [payload] = SAMPLES.withdrawal_failed;
    const email = renderEmail('withdrawal_failed', payload, URLS);

    expect(email.subject).toBe('Penarikan saldo Rp 1.500.000 gagal diproses');
    expect(email.text).toContain('halaman Bantuan');
    expect(email.text).not.toMatch(/dikembalikan|refund/i);
  });

  it('names the applicant without contact details and links to the job postings', () => {
    const [payload] = SAMPLES.merchant_new_applicant;
    const email = renderEmail('merchant_new_applicant', payload, URLS);

    expect(email.subject).toBe('Lamaran baru untuk Mentor AutoCAD');
    expect(email.text).toContain('Fajar melamar posisi Mentor AutoCAD');
    expect(email.html).toContain(`href="${FRONTEND}/merchant/job-posting"`);
  });

  it('words the Pro expiry emails firmly, with the renew or sign-up button', () => {
    const expiring = renderEmail('pro_expiring', SAMPLES.pro_expiring[0], URLS);
    const notRenewed = renderEmail(
      'pro_not_renewed',
      SAMPLES.pro_not_renewed[0],
      URLS,
    );
    const ended = renderEmail('pro_ended', SAMPLES.pro_ended[0], URLS);

    expect(expiring.subject).toBe(
      'Pro Subscription kamu berakhir pada 31 Oktober 2026',
    );
    expect(notRenewed.subject).toBe(
      'Pro Subscription kamu belum diperpanjang dan akan berakhir pada 7 November 2026',
    );
    expect(ended.subject).toBe('Pro Subscription kamu telah berakhir');
    expect(expiring.text).toContain('Perpanjang Pro');
    expect(notRenewed.text).toContain('Perpanjang Pro');
    expect(ended.text).toContain('Daftar Ulang Pro');
    expect(ended.text).toContain('Benefit Pro Subscription');
    for (const email of [expiring, notRenewed, ended]) {
      expect(email.text).not.toMatch(/tambahan|sisa|lagi selama|Masa Pro/i);
      expect(email.html).toContain(`href="${FRONTEND}/merchant/dashboard"`);
    }
  });

  it('words the Pro purchase emails with the plan, amount and next step', () => {
    const awaiting = renderEmail(
      'pro_awaiting_payment',
      SAMPLES.pro_awaiting_payment[0],
      URLS,
    );
    expect(awaiting.text).toContain('Pro 3 Bulan (3 bulan)');
    expect(awaiting.text).toContain('Rp 297.000');
    expect(awaiting.html).toContain('href="https://pay.example/pro"');

    const paid = renderEmail('pro_paid', SAMPLES.pro_paid[0], URLS);
    expect(paid.subject).toBe('Pro Subscription kamu sudah aktif');
    expect(paid.text).toContain('berlaku sampai 13 Januari 2027');
    expect(paid.text).toContain('QRIS');
    expect(paid.text).toContain('13 Oktober 2026, 10.00 WIB');
    expect(paid.html).toContain(`href="${FRONTEND}/merchant/dashboard"`);

    const free = renderEmail(
      'pro_paid',
      { ...SAMPLES.pro_paid[0], total_amount: 0, payment_method: null },
      URLS,
    );
    expect(free.text).toContain('Gratis');

    const failed = renderEmail('pro_failed', SAMPLES.pro_failed[0], URLS);
    expect(failed.subject).toBe(
      'Pembayaran Pro Subscription PRO-20261013-0001 gagal',
    );
    expect(failed.text).not.toContain('aktif dan berlaku');
    expect(failed.html).toContain(`href="${FRONTEND}/merchant/dashboard"`);
  });

  it('escapes the plan name and owner name in the Pro emails', () => {
    const email = renderEmail(
      'pro_paid',
      {
        ...SAMPLES.pro_paid[0],
        owner_name: '<b>Bambang</b>',
        plan_name: 'Pro <script>',
      },
      URLS,
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<b>Bambang</b>');
  });

  it('sends each announcement reader to their own page', () => {
    const [payload] = SAMPLES.class_announcement;
    const learner = renderEmail('class_announcement', payload, URLS);
    expect(learner.subject).toBe('Pengumuman baru di kelas AutoCAD Dasar');
    expect(learner.text).toContain(
      'Studio Sipil membuat pengumuman baru di kelas AutoCAD Dasar.',
    );
    expect(learner.text).toContain('Ujian akhir dimulai Senin');
    expect(learner.html).toContain(`href="${FRONTEND}/portal-saya"`);
    expect(
      renderEmail('class_announcement', { ...payload, audience: 'tutor' }, URLS)
        .html,
    ).toContain(`href="${FRONTEND}/mentor/diskusi"`);
    expect(
      renderEmail(
        'class_announcement',
        { ...payload, audience: 'merchant', title: '<script>x</script>' },
        URLS,
      ).html,
    ).not.toContain('<script>x</script>');
  });

  it('names the class, store and role in the tutor assignment email', () => {
    const email = renderEmail(
      'class_tutor_assigned',
      SAMPLES.class_tutor_assigned[0],
      URLS,
    );
    expect(email.subject).toBe('Kamu ditugaskan di kelas AutoCAD Dasar');
    expect(email.text).toContain(
      'Studio Sipil menambahkan kamu sebagai Asisten Tutor di kelas AutoCAD Dasar.',
    );
    expect(email.html).toContain(`href="${FRONTEND}/mentor/kelas"`);
    const lead = renderEmail(
      'class_tutor_assigned',
      {
        ...SAMPLES.class_tutor_assigned[0],
        role: 'lead',
        class_title: '<b>X</b>',
      },
      URLS,
    );
    expect(lead.text).toContain('Lead Tutor / Instruktur Utama');
    expect(lead.html).not.toContain('<b>X</b>');
  });

  it('shows merchant instructions only under items that have them', () => {
    const [payload] = SAMPLES.order_paid;
    const email = renderEmail('order_paid', payload, URLS);

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

  it('shows the buyer-paid platform fee on the receipt and the payment request', () => {
    const [paid] = SAMPLES.order_paid;
    const [awaiting] = SAMPLES.order_awaiting_payment;
    for (const [kind, payload] of [
      ['order_paid', paid],
      ['order_awaiting_payment', awaiting],
    ] as const) {
      const email = renderEmail(
        kind,
        { ...payload, platform_fee_amount: 4325, total_amount: 177325 },
        URLS,
      );
      expect(email.text).toContain('Biaya layanan: Rp 4.325');
      expect(email.text).toContain('Rp 177.325');
    }
    expect(renderEmail('order_paid', paid, URLS).text).not.toContain(
      'Biaya layanan',
    );
  });

  it('leaves the instruction section out when no item has instructions', () => {
    const [payload] = SAMPLES.order_paid;
    const email = renderEmail(
      'order_paid',
      { ...payload, items: [{ ...payload.items[1] }] },
      URLS,
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
      URLS,
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
        URLS,
      ).text;
    expect(render('basic', 'silver')).toContain('naik ke Silver');
    expect(render('gold', 'silver')).toContain('turun ke Silver');
    expect(render('gold', 'gold')).toContain('tetap Gold');
    expect(render('basic', 'silver')).toContain('5 GB');
  });

  it('tells the buyer the payment did not go through and where to get help', () => {
    const [payload] = SAMPLES.order_failed;
    const text = renderEmail('order_failed', payload, URLS).text;
    expect(text).toContain(
      'Pembayaran pesanan ORD-20261005-0012 belum berhasil diproses, pesanan telah dibatalkan.',
    );
    expect(text).toContain(
      'Jika butuh bantuan, silahkan hubungi kami lewat halaman Bantuan dengan menyertakan nomor pesanan.',
    );
  });

  it('ends the inactivity warning with the deletion notice', () => {
    const [payload] = SAMPLES.merchant_inactivity_warning;
    const email = renderEmail('merchant_inactivity_warning', payload, URLS);
    expect(email.text).toContain('diskon serta voucher dinonaktifkan.');
    expect(email.text).not.toContain('Satu transaksi saja');
  });

  it('asks learners to follow the changed session schedule', () => {
    const [payload] = SAMPLES.meeting_updated;
    expect(renderEmail('meeting_updated', payload, URLS).text).toContain(
      'Jadwal sesi di Bootcamp Manajemen Proyek diubah. Mohon sesuaikan dengan jadwal yang baru berikut.',
    );
  });

  it('asks the buyer to pay before the deadline', () => {
    const [payload] = SAMPLES.order_awaiting_payment;
    expect(renderEmail('order_awaiting_payment', payload, URLS).text).toContain(
      'Pesanan kamu sudah dibuat. Mohon selesaikan pembayaran sebelum 5 Oktober 2026, 15.30 WIB. Pesanan akan dibatalkan otomatis jika lewat dari batas waktu.',
    );
  });

  it('tells the buyer the payment time ran out and nothing was charged', () => {
    const [payload] = SAMPLES.order_expired;
    const email = renderEmail('order_expired', payload, URLS);
    expect(email.html).toContain('Batas waktu pembayaran telah kadaluwarsa.');
    const text = email.text;
    expect(text).toContain(
      'Batas waktu pembayaran pesanan ORD-20261005-0012 telah habis. Pesanan dibatalkan secara otomatis. Tidak ada dana yang terpotong.',
    );
    expect(text).not.toContain('Kamu bisa memesan ulang');
  });

  it('names the graded assignment after the subject label, so a title starting with Tugas reads once', () => {
    const [payload] = SAMPLES.submission_graded;
    expect(
      renderEmail(
        'submission_graded',
        { ...payload, assignment_title: 'Tugas 1: Denah' },
        URLS,
      ).subject,
    ).toBe('Tugas sudah dinilai: Tugas 1: Denah');
  });

  it('labels a free order as Gratis and a rescheduled interview as changed', () => {
    const [paid] = SAMPLES.order_paid;
    expect(
      renderEmail('order_paid', { ...paid, payment_method: null }, URLS).text,
    ).toContain('Metode pembayaran: Gratis');
    const [interview] = SAMPLES.interview_scheduled;
    expect(
      renderEmail(
        'interview_scheduled',
        { ...interview, rescheduled: true },
        URLS,
      ).subject,
    ).toBe('Jadwal wawancara diubah: Mentor AutoCAD');
  });

  it('links the reset email to the reset page with its token', () => {
    const [payload] = SAMPLES.password_reset;
    const email = renderEmail('password_reset', payload, URLS);
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
        URLS,
      ),
    ).toThrow('the reset token was already removed');
  });

  it('words the password notice for a reset, with a sign-in button', () => {
    const [payload] = SAMPLES.password_changed;
    const email = renderEmail(
      'password_changed',
      { ...payload, via_reset: true },
      URLS,
    );
    expect(email.text).toContain('diatur ulang lewat tautan email');
    expect(email.text).toContain('dikeluarkan dari semua perangkat.');
    expect(email.text).toContain(`Masuk: ${FRONTEND}/login`);
    expect(renderEmail('password_changed', payload, URLS).text).toContain(
      'semua perangkat lain',
    );
  });

  it('reminds learners with the join link, or Portal Saya without one', () => {
    const [payload] = SAMPLES.meeting_reminder;
    const withLink = renderEmail('meeting_reminder', payload, URLS);
    expect(withLink.subject).toBe(
      'Reminder: kelas Sesi 3: Kurva S akan dimulai dalam 60 menit',
    );
    expect(withLink.text).toContain(
      'akan dimulai dalam 60 menit. Siapkan perangkat dan koneksi kamu.',
    );
    expect(withLink.text).toContain('Tanggal: 12 Oktober 2026, 19.00 WIB');
    expect(withLink.text).not.toMatch(/sekitar|1 jam/);
    expect(withLink.text).toContain('Gabung sesi: https://zoom.us/j/1');
    expect(
      renderEmail('meeting_reminder', { ...payload, live_url: null }, URLS)
        .text,
    ).toContain(`Buka Portal Saya: ${FRONTEND}/portal-saya`);
  });

  it('reminds the mentor with mentor wording and the dashboard fallback', () => {
    const [payload] = SAMPLES.meeting_mentor_reminder;
    const email = renderEmail('meeting_mentor_reminder', payload, URLS);
    expect(email.subject).toBe(
      'Reminder: kelas Sesi 3: Kurva S akan dimulai dalam 60 menit',
    );
    expect(email.text).toContain('Kelas akan dimulai dalam 60 menit');
    expect(email.text).toContain(
      'Kamu dijadwalkan mengajar sesi di Bootcamp Manajemen Proyek dalam 60 menit.',
    );
    expect(email.text).not.toMatch(/Anda|sekitar/);
    expect(
      renderEmail(
        'meeting_mentor_reminder',
        { ...payload, live_url: null },
        URLS,
      ).text,
    ).toContain(`Buka dashboard mentor: ${FRONTEND}/mentor/dashboard`);
  });

  it('summarises the week with the range, reviews and top items, without a total', () => {
    const [payload] = SAMPLES.merchant_weekly_report;
    const email = renderEmail('merchant_weekly_report', payload, URLS);
    expect(email.subject).toBe(
      'Laporan mingguan Studio Sipil: 28 September 2026 – 4 Oktober 2026',
    );
    expect(email.text).toContain('Ulasan baru: 3 (rata-rata 4,7 / 5)');
    expect(email.text).toContain(
      '- Template RAB · 5 terjual (Produk Digital): Rp 595.000',
    );
    expect(email.text).not.toContain('Total');
    expect(email.text).toContain(
      `Buka dashboard: ${FRONTEND}/merchant/dashboard`,
    );
    const quiet = renderEmail(
      'merchant_weekly_report',
      { ...payload, top_items: [], new_reviews: 0, average_rating: null },
      URLS,
    );
    expect(quiet.text).toContain('Ulasan baru: Belum ada');
    expect(quiet.text).not.toContain('PALING LARIS');
  });

  it.each([
    [1245000, 980000, 'naik 27% dari minggu lalu (Rp 980.000)'],
    [500000, 1000000, 'turun 50% dari minggu lalu (Rp 1.000.000)'],
    [100000, 100000, 'sama dengan minggu lalu'],
    [100000, 0, 'minggu lalu belum ada pendapatan'],
  ])('words a change from %d to %d', (revenue, previous, expected) => {
    expect(weeklyChange(revenue, previous)).toBe(expected);
  });

  it('shows a moved session from the old date to the new one', () => {
    const [payload] = SAMPLES.meeting_updated;
    const text = renderEmail('meeting_updated', payload, URLS).text;
    expect(text).toContain(
      'Jadwal sebelumnya: 10 Oktober 2026, 19.00 WIB\nJadwal baru: 12 Oktober 2026, 19.00 WIB',
    );
    expect(text).not.toContain('Waktu');
  });

  it('labels standalone dates as Tanggal', () => {
    for (const kind of [
      'meeting_created',
      'meeting_cancelled',
      'interview_scheduled',
    ] as const) {
      const [payload] = SAMPLES[kind] as [never, string];
      const text = renderEmail(kind, payload, URLS).text;
      expect(text).toMatch(/Tanggal: \d+ \w+ 2026, \d{2}\.\d{2} WIB/);
      expect(text).not.toMatch(/^Waktu:/m);
    }
  });

  it('labels the merchant sale time as the transaction time', () => {
    const [payload] = SAMPLES.merchant_new_sale;
    const text = renderEmail('merchant_new_sale', payload, URLS).text;
    expect(text).toContain('Waktu transaksi: 5 Oktober 2026, 14.41 WIB');
    expect(text).not.toContain('Waktu pembayaran');
  });

  it('uses kamu everywhere, never Anda', () => {
    for (const kind of emailKinds) {
      const [payload] = SAMPLES[kind] as [never, string];
      expect(renderEmail(kind, payload, URLS).text).not.toMatch(/\bAnda\b/);
    }
  });

  it('asks readers not to reply in every footer', () => {
    for (const kind of emailKinds) {
      const [payload] = SAMPLES[kind] as [never, string];
      expect(renderEmail(kind, payload, URLS).text).toContain(
        'Mohon tidak membalas email ini.',
      );
    }
  });

  it.each([
    ['added', 'ditambahkan ke toko'],
    ['deleted', 'dihapus dari toko'],
    ['updated', 'diubah di toko'],
    ['primary', 'dijadikan rekening utama di toko'],
  ])('uses the right preposition when an account is %s', (action, phrase) => {
    const [payload] = SAMPLES.payout_account_changed;
    expect(
      renderEmail(
        'payout_account_changed',
        { ...payload, action } as never,
        URLS,
      ).text,
    ).toContain(phrase);
  });

  it('shows a rescheduled interview from the old date to the new one', () => {
    const [payload] = SAMPLES.interview_scheduled;
    const moved = renderEmail(
      'interview_scheduled',
      {
        ...payload,
        rescheduled: true,
        previous_interview_at: '2026-10-07T03:00:00Z',
      },
      URLS,
    ).text;
    expect(moved).toContain(
      'Jadwal wawancara kamu diubah untuk posisi Mentor AutoCAD di Studio Sipil.',
    );
    expect(moved).toContain(
      'Jadwal sebelumnya: 7 Oktober 2026, 10.00 WIB\nJadwal baru: 8 Oktober 2026, 10.00 WIB',
    );
    const first = renderEmail('interview_scheduled', payload, URLS).text;
    expect(first).toContain(
      'Kamu diundang wawancara untuk posisi Mentor AutoCAD',
    );
    expect(first).toContain('Tanggal: 8 Oktober 2026, 10.00 WIB');
  });

  it('dates a certificate without a time', () => {
    const [payload] = SAMPLES.certificate_issued;
    expect(renderEmail('certificate_issued', payload, URLS).text).toContain(
      'Tanggal terbit: 5 Oktober 2026\n',
    );
  });

  it('gives a cancelled meeting no join button', () => {
    const [payload] = SAMPLES.meeting_cancelled;
    const email = renderEmail('meeting_cancelled', payload, URLS);
    expect(email.html).not.toContain('Gabung sesi');
    expect(email.html).not.toContain('https://zoom.us/j/1');
  });
});
