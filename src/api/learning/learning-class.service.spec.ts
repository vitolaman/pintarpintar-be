import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LearningClassService } from './learning-class.service';

describe('LearningClassService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  let query: jest.Mock;
  let learnerAccess: { requireEnrollment: jest.Mock };
  let service: LearningClassService;

  beforeEach(() => {
    query = jest.fn(async (sql: string) => {
      if (sql.includes('AS students_count')) {
        return [
          {
            id: classId,
            title: 'Belajar AutoCAD',
            type: 'video',
            status: 'archived',
            description: null,
            cover_object_key: null,
            merchant_id: 'merchant-id',
            merchant_name: 'Akademi',
            merchant_slug: 'akademi',
            students_count: 12,
          },
        ];
      }
      if (sql.includes('FROM chapters')) {
        return [
          { id: 'chapter-1', title: 'Bab 1', description: null, order: 0 },
        ];
      }
      if (sql.includes('FROM videos video')) {
        return [
          {
            id: 'video-1',
            chapter_id: 'chapter-1',
            title: 'Intro',
            youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
            order: 0,
            is_completed: true,
          },
        ];
      }
      if (sql.includes('FROM file_resources resource')) {
        return [
          {
            id: 'file-1',
            chapter_id: 'chapter-1',
            name: 'Modul',
            type: 'pdf',
            url: null,
            object_key: 'uploads/1-modul.pdf',
            original_filename: 'modul.pdf',
          },
          {
            id: 'link-1',
            chapter_id: 'chapter-1',
            name: 'Referensi',
            type: 'link',
            url: 'https://example.com',
            object_key: null,
          },
        ];
      }
      if (sql.includes('FROM meetings meeting')) {
        return [
          { id: 'meeting-1', title: 'Sesi 1', my_attendance_status: 'hadir' },
          { id: 'meeting-2', title: 'Sesi 2', my_attendance_status: 'izin' },
          { id: 'meeting-3', title: 'Sesi 3', my_attendance_status: null },
        ];
      }
      return [];
    });
    learnerAccess = { requireEnrollment: jest.fn() };
    service = new LearningClassService(
      { manager: { query } } as never,
      learnerAccess as never,
      {
        findProgress: jest.fn(async () => ({
          class_id: classId,
          progress: 100,
          next_video: null,
        })),
      } as never,
      {
        findLearnerView: jest.fn(async () => ({ status: 'ineligible' })),
      } as never,
      new ConfigService({
        AWS_S3_BUCKET_NAME: 'bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
      }),
    );
  });

  it('returns 404 before reading anything when not enrolled', async () => {
    learnerAccess.requireEnrollment.mockRejectedValue(new NotFoundException());

    await expect(service.findClass(userId, classId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('returns content with YouTube ids, signed files and plain links', async () => {
    const { data } = await service.findClass(userId, classId);

    const [chapter] = data.chapters;
    expect(chapter.videos[0]).toMatchObject({
      youtube_id: 'dQw4w9WgXcQ',
      is_completed: true,
    });
    const [file, link] = chapter.files;
    expect(file.url).toBeNull();
    expect(file.download_url).toContain('X-Amz-Expires=600');
    expect(link).toMatchObject({
      url: 'https://example.com',
      download_url: null,
    });
    expect(data).toMatchObject({
      status: 'archived',
      progress: 100,
      certificate: { status: 'ineligible' },
    });
  });

  it("gives each meeting the caller's attendance from the meeting query", async () => {
    const { data } = await service.findClass(userId, classId);

    expect(
      data.meetings.map((meeting) => [
        meeting.id,
        meeting.my_attendance_status,
      ]),
    ).toEqual([
      ['meeting-1', 'hadir'],
      ['meeting-2', 'izin'],
      ['meeting-3', null],
    ]);
    const meetingQueries = query.mock.calls.filter(([sql]) =>
      (sql as string).includes('attendances attendance'),
    );
    expect(meetingQueries).toHaveLength(1);
    expect(meetingQueries[0][0]).toContain('FROM meetings meeting');
    expect(meetingQueries[0][1]).toEqual([classId, userId]);
  });
});
