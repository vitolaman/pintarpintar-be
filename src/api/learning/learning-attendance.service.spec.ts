import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassAttendanceService } from '../../class/class-attendance.service';
import { LearningAttendanceService } from './learning-attendance.service';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';
const openMeeting = {
  id: 'meeting-2',
  title: 'Pertemuan 2',
  date: '2026-09-30',
  time: '19:00',
  is_open: true,
};

describe('LearningAttendanceService', () => {
  const query = jest.fn();
  const checkIn = jest.fn();
  const service = new LearningAttendanceService(
    { query } as unknown as DataSource,
    { checkIn } as unknown as ClassAttendanceService,
  );
  const input = {
    name: 'Ahmad Rizki',
    email: 'Ahmad@Student.id',
    feedback: 'Materi jelas',
  };

  beforeEach(() => {
    query.mockReset();
    checkIn.mockReset();
  });

  it('returns the session with the open meeting and no meeting link', async () => {
    query
      .mockResolvedValueOnce([
        {
          id: CLASS_ID,
          title: 'Bootcamp Revit',
          type: 'live-bootcamp',
          cover_object_key: null,
          merchant_name: 'Akademi Teknik',
          mentor_names: ['Budi'],
        },
      ])
      .mockResolvedValueOnce([openMeeting]);

    const { data } = await service.findSession(CLASS_ID);

    expect(data).toEqual({
      class_id: CLASS_ID,
      class_title: 'Bootcamp Revit',
      class_type: 'live-bootcamp',
      cover_url: null,
      merchant_name: 'Akademi Teknik',
      mentor_names: ['Budi'],
      meeting: openMeeting,
    });
    expect(query.mock.calls[1][0]).not.toContain('liveUrl');
  });

  it('reports an unknown, deleted, or draft class as not found', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.findSession(CLASS_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('checks an enrolled learner in to the latest started meeting', async () => {
    query
      .mockResolvedValueOnce([
        { class_title: 'Bootcamp Revit', user_id: 'user-1' },
      ])
      .mockResolvedValueOnce([openMeeting])
      .mockResolvedValueOnce([{ check_in_time: '19:05' }]);

    const { data } = await service.checkInByEmail(CLASS_ID, input);

    expect(query.mock.calls[0][1]).toEqual([CLASS_ID, 'Ahmad@Student.id']);
    expect(query.mock.calls[0][0]).toContain(
      'lower(learner.email) = lower($2)',
    );
    expect(checkIn).toHaveBeenCalledWith('user-1', 'meeting-2', 'Materi jelas');
    expect(data).toEqual({
      class_id: CLASS_ID,
      class_title: 'Bootcamp Revit',
      meeting_id: 'meeting-2',
      meeting_title: 'Pertemuan 2',
      check_in_time: '19:05',
      name: 'Ahmad Rizki',
    });
  });

  it('rejects an email that is not enrolled', async () => {
    query.mockResolvedValueOnce([
      { class_title: 'Bootcamp Revit', user_id: null },
    ]);
    await expect(service.checkInByEmail(CLASS_ID, input)).rejects.toThrow(
      'This email is not enrolled in this class',
    );
    expect(checkIn).not.toHaveBeenCalled();
  });

  it('rejects a check-in before any meeting has started', async () => {
    query
      .mockResolvedValueOnce([
        { class_title: 'Bootcamp Revit', user_id: 'user-1' },
      ])
      .mockResolvedValueOnce([{ ...openMeeting, is_open: false }]);
    await expect(
      service.checkInByEmail(CLASS_ID, input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(checkIn).not.toHaveBeenCalled();
  });

  it('rejects an unknown class', async () => {
    query.mockResolvedValueOnce([]);
    await expect(
      service.checkInByEmail(CLASS_ID, input),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
