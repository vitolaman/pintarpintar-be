import { EntityManager } from 'typeorm';
import { queueEmails } from '../email-queue';
import {
  excerptOf,
  queueClassAnnouncementEmails,
} from './class-announcement-emails';

jest.mock('../email-queue', () => ({
  guardEmailQueue: jest.fn((manager, _label, queue) => queue(manager)),
  queueEmails: jest.fn(),
}));

describe('queueClassAnnouncementEmails', () => {
  it('queues one email per recipient with its own button audience', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          title: 'Jadwal ujian',
          content: 'Ujian   dimulai\nSenin.',
          class_title: 'AutoCAD Dasar',
          author_name: 'Rexi',
        },
      ])
      .mockResolvedValueOnce([
        {
          user_id: 'u1',
          name: 'Ayu',
          email: 'ayu@x.test',
          audience: 'learner',
        },
        {
          user_id: 'u2',
          name: 'Toko',
          email: 'toko@x.test',
          audience: 'merchant',
        },
      ]);
    const manager = { query } as unknown as EntityManager;

    await queueClassAnnouncementEmails(manager, 'thread-1');

    const [recipientsSql, params] = query.mock.calls[1];
    expect(params).toEqual(['thread-1']);
    expect(recipientsSql).toContain('member.user_id <> thread.author_id');
    expect(recipientsSql).toContain('enrollment.deleted_at IS NULL');
    expect(recipientsSql).toContain("mentor.status = 'active'");
    expect(queueEmails).toHaveBeenCalledWith(manager, [
      expect.objectContaining({
        kind: 'class_announcement',
        to: 'ayu@x.test',
        dedupeKey: 'announcement:thread-1:u1',
        payload: expect.objectContaining({
          audience: 'learner',
          excerpt: 'Ujian dimulai Senin.',
        }),
      }),
      expect.objectContaining({
        to: 'toko@x.test',
        dedupeKey: 'announcement:thread-1:u2',
        payload: expect.objectContaining({ audience: 'merchant' }),
      }),
    ]);
  });
});

describe('excerptOf', () => {
  it('keeps a short text and cuts a long one at a word', () => {
    expect(excerptOf('  Halo\n semua ')).toBe('Halo semua');
    const long = `${'kata '.repeat(100)}akhir`;
    const excerpt = excerptOf(long);
    expect(excerpt.length).toBeLessThanOrEqual(301);
    expect(excerpt.endsWith('kata…')).toBe(true);
  });
});
