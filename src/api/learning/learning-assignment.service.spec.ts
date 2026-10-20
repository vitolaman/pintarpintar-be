import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LearningAssignmentService } from './learning-assignment.service';

describe('LearningAssignmentService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const assignmentId = '60000000-0000-4000-8000-000000000001';
  const baseRow = {
    id: assignmentId,
    class_id: 'class-id',
    title: 'Kuis',
    description: null,
    type: 'quiz',
    due: new Date(Date.now() - 1000),
    resource_asset_id: null,
    question_count: 2,
    total_weight: 40,
    submission_id: null,
    submitted_at: null,
    is_late: null,
    file_name: null,
    total_score: null,
    feedback: null,
  };
  let query: jest.Mock;
  let learnerAccess: { requireEnrollment: jest.Mock };
  let service: LearningAssignmentService;

  beforeEach(() => {
    query = jest.fn(async () => []);
    learnerAccess = { requireEnrollment: jest.fn() };
    service = new LearningAssignmentService(
      { manager: { query }, query } as never,
      learnerAccess as never,
      new ConfigService({
        AWS_S3_BUCKET_NAME: 'bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
      }),
    );
  });

  it('never selects answer keys for learners', async () => {
    query.mockResolvedValue([]);

    await service.findAssignments(userId, 'class-id');

    expect(query.mock.calls[0][0]).not.toContain('correct_answer');
  });

  it('returns quiz questions without answer keys', async () => {
    query
      .mockResolvedValueOnce([baseRow])
      .mockResolvedValueOnce([{ id: 'q1', question_text: 'Q', type: 'essay' }]);

    const { data } = await service.findQuiz(userId, assignmentId);

    expect(query.mock.calls[1][0]).not.toContain('correct_answer');
    expect(data).toMatchObject({ is_past_due: true, my_submission: null });
  });

  it('treats a file assignment as no quiz', async () => {
    query.mockResolvedValueOnce([{ ...baseRow, type: 'file_upload' }]);

    await expect(service.findQuiz(userId, assignmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hides assignments of classes the learner is not enrolled in', async () => {
    query.mockResolvedValueOnce([baseRow]);
    learnerAccess.requireEnrollment.mockRejectedValue(new NotFoundException());

    await expect(service.findQuiz(userId, assignmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    [null, 'submitted'],
    [80, 'graded'],
  ])('reports a submission scored %p as %p', async (score, status) => {
    const assignment = await service.describe({ query } as never, {
      ...baseRow,
      submission_id: 'submission-id',
      submitted_at: new Date(),
      is_late: true,
      total_score: score,
    });

    expect(assignment.my_submission).toMatchObject({ status, is_late: true });
  });

  it('lists every resource file in order, the first also as resource', async () => {
    const file = (id: string, name: string) => ({
      assignment_id: assignmentId,
      id,
      object_key: `uploads/${name}`,
      original_filename: name,
      size_bytes: '2048',
    });
    query
      .mockResolvedValueOnce([{ ...baseRow, type: 'file_upload' }])
      .mockResolvedValueOnce([
        file('a1', 'brief.pdf'),
        file('a2', 'data.xlsx'),
      ]);

    const { data } = await service.findAssignments(userId, 'class-id');

    expect(query.mock.calls[1][0]).toContain('assignment_resources');
    expect(data[0].resources.map((resource) => resource.name)).toEqual([
      'brief.pdf',
      'data.xlsx',
    ]);
    expect(data[0].resources[0]).toMatchObject({ size: 2048 });
    expect(data[0].resource).toEqual(data[0].resources[0]);
  });

  it('returns no resource without files', async () => {
    query.mockResolvedValueOnce([{ ...baseRow, type: 'file_upload' }]);

    const { data } = await service.findAssignments(userId, 'class-id');

    expect(data[0]).toMatchObject({ resource: null, resources: [] });
  });
});
