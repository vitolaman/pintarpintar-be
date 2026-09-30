import { NotFoundException } from '@nestjs/common';
import { LearnerAccessService } from './learner-access.service';

describe('LearnerAccessService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  let query: jest.Mock;
  let service: LearnerAccessService;

  beforeEach(() => {
    query = jest.fn();
    service = new LearnerAccessService({ manager: { query } } as never);
  });

  it('returns the active enrollment of a learner', async () => {
    query.mockResolvedValue([
      {
        enrollment_id: 'enrollment-id',
        class_id: classId,
        merchant_id: 'merchant-id',
        type: 'video',
        status: 'archived',
      },
    ]);

    await expect(service.requireEnrollment(userId, classId)).resolves.toEqual({
      enrollmentId: 'enrollment-id',
      classId,
      merchantId: 'merchant-id',
      classType: 'video',
      classStatus: 'archived',
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('enrollment.deleted_at IS NULL');
    expect(sql).toContain('class.deleted_at IS NULL');
    expect(params).toEqual([userId, classId]);
  });

  it('hides classes the user is not enrolled in, or that were deleted', async () => {
    query.mockResolvedValue([]);

    await expect(
      service.requireEnrollment(userId, classId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
