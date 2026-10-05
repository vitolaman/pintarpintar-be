import { DataSource } from 'typeorm';
import { EmailReminderJobs } from './email-reminder-jobs.service';
import { reminderEmail, ReminderRow } from './events/learning-emails';

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
    const jobs = new EmailReminderJobs({
      manager: { transaction },
    } as unknown as DataSource);

    const first = jobs.queueMeetingReminders();
    await jobs.queueMeetingReminders();
    release();
    await first;

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
