import { DataSource } from 'typeorm';
import { MentorRosterService } from './mentor-roster.service';

describe('MentorRosterService', () => {
  const ownerId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  const mentorId = '70000000-0000-4000-8000-000000000001';

  const rosterRow = (userId: string, mentorIdValue: string | null) => ({
    user_id: userId,
    mentor_id: mentorIdValue,
    name: 'Budi',
    email: 'budi@example.com',
    avatar_object_key: null,
    specialty: null,
    classes_count: 0,
    rating: null,
    joined_at: null,
  });

  let query: jest.Mock;
  let service: MentorRosterService;

  beforeEach(() => {
    query = jest.fn(async (sql: string) => {
      if (sql.includes('AS mentor_id')) {
        return [
          rosterRow('user-1', mentorId),
          rosterRow('user-2', null),
          rosterRow('user-3', mentorId),
        ];
      }
      return [
        { active_jobs: 1, pending_applications: 0, total_applications: 0 },
      ];
    });
    service = new MentorRosterService({
      query,
      manager: {
        findOne: jest.fn(async () => ({ id: merchantId, status: 'active' })),
      },
    } as unknown as DataSource);
  });

  it("gives each roster entry the user's mentor id from the roster query", async () => {
    const { data } = await service.findRoster(ownerId);

    expect(data.mentors.map((row) => [row.user_id, row.mentor_id])).toEqual([
      ['user-1', mentorId],
      ['user-2', null],
      ['user-3', mentorId],
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    const [rosterSql, params] = query.mock.calls.find(([sql]) =>
      sql.includes('AS mentor_id'),
    ) as [string, unknown[]];
    expect(rosterSql).toContain("CASE WHEN mentor.status = 'active'");
    expect(params).toEqual([merchantId, null]);
  });
});
