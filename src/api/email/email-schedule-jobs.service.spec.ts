import { DataSource } from 'typeorm';
import { EmailScheduleJobs } from './email-schedule-jobs.service';
import { reminderEmail, ReminderRow } from './events/learning-emails';
import { weeklyReportEmail } from './events/merchant-report-emails';

const row = (overrides: Partial<ReminderRow> = {}): ReminderRow => ({
  meeting_id: 'meeting-1',
  user_id: 'user-1',
  name: 'Ayu',
  email: 'ayu@example.test',
  role: 'learner',
  title: 'Sesi 3',
  starts_at: new Date('2026-10-12T12:00:00Z'),
  duration_minutes: null,
  live_url: 'https://zoom.us/j/1',
  class_title: 'Bootcamp',
  ...overrides,
});

describe('meeting reminders', () => {
  it('keys a reminder by meeting, start time and recipient, expiring at the start', () => {
    const email = reminderEmail(row());
    expect(email).toMatchObject({
      kind: 'meeting_reminder',
      to: 'ayu@example.test',
      dedupeKey: 'meeting:meeting-1:reminder:2026-10-12T12:00:00.000Z:user-1',
      expiresAt: new Date('2026-10-12T12:00:00Z'),
    });
    expect(email.payload).toMatchObject({
      learner_name: 'Ayu',
      starts_at: '2026-10-12T12:00:00.000Z',
      duration_minutes: 180,
      previous_starts_at: null,
    });
  });

  it('gives a moved meeting a new key', () => {
    expect(reminderEmail(row()).dedupeKey).not.toBe(
      reminderEmail(row({ starts_at: new Date('2026-10-12T14:00:00Z') }))
        .dedupeKey,
    );
  });

  it('uses the mentor template for the mentor', () => {
    expect(reminderEmail(row({ role: 'mentor' })).kind).toBe(
      'meeting_mentor_reminder',
    );
  });

  it('never runs twice at once', async () => {
    let release: () => void = () => undefined;
    const transaction = jest.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const jobs = new EmailScheduleJobs({
      manager: { transaction },
    } as unknown as DataSource);

    const first = jobs.queueMeetingReminders();
    await jobs.queueMeetingReminders();
    release();
    await first;

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('keys a weekly report by store and week, with numbers from the row', () => {
    const email = weeklyReportEmail(
      {
        merchant_id: 'merchant-1',
        store_name: 'Studio Sipil',
        owner_id: 'owner-1',
        owner_name: 'Bambang',
        owner_email: 'bambang@example.test',
        revenue: '600000.00',
        previous_revenue: '400000',
        transactions: 2,
        buyers: 2,
        top_items: [
          { title: 'RAB', type: 'digital', amount: '600000.00', sold: 2 },
        ],
        new_reviews: 1,
        average_rating: '4.0',
        withdrawable_balance: '150000',
      },
      '2026-09-28',
    );
    expect(email).toMatchObject({
      kind: 'merchant_weekly_report',
      to: 'bambang@example.test',
      dedupeKey: 'weekly-report:merchant-1:2026-09-28',
      payload: {
        week_start: '2026-09-28',
        week_end: '2026-10-04',
        revenue: 600000,
        previous_revenue: 400000,
        top_items: [{ title: 'RAB', type: 'digital', amount: 600000, sold: 2 }],
        average_rating: 4,
        withdrawable_balance: 150000,
      },
    });
  });

  it('never runs two weekly report jobs at once', async () => {
    let release: () => void = () => undefined;
    const transaction = jest.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const jobs = new EmailScheduleJobs({
      manager: { transaction },
    } as unknown as DataSource);

    const first = jobs.queueWeeklyReports();
    await jobs.queueWeeklyReports();
    release();
    await first;

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
