import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';
import { CheckInDto, SetAttendanceStatusDto } from './attendance.dto';
import { UpdateCertificateSettingsDto } from './certificate.dto';
import { ClassListQueryDto } from './class-list-query.dto';
import { CreateChapterDto } from './create-chapter.dto';
import { CreateClassDto } from './create-class.dto';
import { CreateMeetingDto } from './create-meeting.dto';
import { GradeSubmissionDto } from './grading.dto';
import { InviteMentorDto } from './invite-mentor.dto';
import { UpdateChapterDto } from './update-chapter.dto';
import { UpdateClassMentorDto } from './update-class-mentor.dto';
import { UpdateMeetingDto } from './update-meeting.dto';
import { UpdateClassDto } from './update-class.dto';

async function errorFields(target: new () => object, input: object) {
  const errors = await validate(plainToInstance(target, input));
  return errors.map((error) => error.property);
}

describe('class DTO validation', () => {
  it.each([
    [{ title: null }, ['title']],
    [{ status: null }, ['status']],
    [{ type: 'webinar' }, ['type']],
    [{ originalPrice: -1 }, ['originalPrice']],
    [{ discountedPrice: -5 }, ['discountedPrice']],
    [{ cover_asset_id: 'not-a-uuid' }, ['cover_asset_id']],
    [{ description: null, cover_asset_id: null, discountedPrice: null }, []],
    [{ post_purchase_instructions: null, status: 'archived' }, []],
    [{ category: 'Hukum' }, ['category']],
    [{ level: 'Expert' }, ['level']],
    [{ learning_outcomes: ['ok', ''] }, ['learning_outcomes']],
    [{ learning_outcomes: Array(21).fill('x') }, ['learning_outcomes']],
    [{ duration: 'x'.repeat(61) }, ['duration']],
    [
      {
        category: null,
        level: null,
        duration: null,
        prerequisites: null,
        learning_outcomes: null,
      },
      [],
    ],
    [
      {
        category: 'Sipil',
        level: 'Pemula',
        learning_outcomes: ['Membuat denah'],
      },
      [],
    ],
    [{}, []],
  ])('update %j fails on %j', async (input, fields) => {
    expect(await errorFields(UpdateClassDto, input)).toEqual(fields);
  });

  it.each([
    [{ title: 'Kelas', originalPrice: -1 }, ['originalPrice']],
    [{ title: '' }, ['title']],
    [{ title: 'Kelas', cover_asset_id: 'x' }, ['cover_asset_id']],
    [{ title: 'Kelas', originalPrice: 100000, discountedPrice: 90000 }, []],
    [
      {
        title: 'Kelas',
        category: 'Coding',
        level: 'Mahir',
        duration: '20 jam',
      },
      [],
    ],
    [{ title: 'Kelas', level: 'Expert' }, ['level']],
    [{ title: '  ' }, ['title']],
    [{ title: 'Kelas', status: null }, ['status']],
    [
      { title: 'Kelas', learning_outcomes: 'Membuat denah' },
      ['learning_outcomes'],
    ],
  ])('create %j fails on %j', async (input, fields) => {
    expect(await errorFields(CreateClassDto, input)).toEqual(fields);
  });

  it.each([
    [{ limit: '101' }, []],
    [{ type: 'kelas-video' }, ['type']],
    [{ status: 'unlisted' }, ['status']],
    [{ page: '0' }, []],
    [{ type: 'live-bootcamp', status: 'published', limit: '100' }, []],
  ])('list query %j fails on %j', async (input, fields) => {
    expect(await errorFields(ClassListQueryDto, input)).toEqual(fields);
  });

  const meeting = { title: 'Sesi 1', date: '2026-10-12', time: '19:00' };

  it.each([
    [{}, []],
    [
      {
        duration_minutes: 90,
        mentor_id: '50000000-0000-4000-8000-000000000001',
      },
      [],
    ],
    [{ duration_minutes: 1 }, []],
    [{ duration_minutes: 1440 }, []],
    [{ duration_minutes: 0 }, ['duration_minutes']],
    [{ duration_minutes: 1441 }, ['duration_minutes']],
    [{ duration_minutes: 90.5 }, ['duration_minutes']],
    [{ duration_minutes: null, mentor_id: null }, []],
    [{ mentor_id: 'mentor' }, ['mentor_id']],
  ])('validates new meeting details %j', async (input, fields) => {
    expect(
      await errorFields(CreateMeetingDto, { ...meeting, ...input }),
    ).toEqual(fields);
  });

  it.each([
    [{ duration_minutes: null, mentor_id: null }, []],
    [{ duration_minutes: 0 }, ['duration_minutes']],
    [{ mentor_id: 'mentor' }, ['mentor_id']],
  ])('validates meeting detail updates %j', async (input, fields) => {
    expect(await errorFields(UpdateMeetingDto, input)).toEqual(fields);
  });

  describe('clearing, required text, enums and numbers', () => {
    it('clears optional class text and nullable enums with "" or null', async () => {
      const dto = plainToInstance(UpdateClassDto, {
        description: '',
        post_purchase_instructions: null,
        duration: '   ',
        prerequisites: '',
        category: '',
        level: null,
      });

      expect(dto).toMatchObject({
        description: null,
        post_purchase_instructions: null,
        duration: null,
        prerequisites: null,
        category: null,
        level: null,
      });
      expect(await validate(dto)).toEqual([]);
    });

    it.each([[''], ['  '], [null]])(
      'rejects the required class title %j',
      async (title) => {
        expect(await errorFields(UpdateClassDto, { title })).toEqual(['title']);
        expect(await errorFields(CreateClassDto, { title })).toEqual(['title']);
      },
    );

    it.each([
      [{ status: '' }, ['status']],
      [{ type: null }, ['type']],
      [{ originalPrice: null }, ['originalPrice']],
    ])('rejects clearing NOT NULL class field %j', async (input, fields) => {
      expect(await errorFields(UpdateClassDto, input)).toEqual(fields);
    });

    it('stores class enums canonically and accepts numeric strings', async () => {
      const dto = plainToInstance(CreateClassDto, {
        title: '  Kelas  ',
        status: ' Published ',
        type: 'LIVE-BOOTCAMP',
        category: 'sipil',
        level: ' mahir',
        originalPrice: '150000',
        discountedPrice: '',
      });

      expect(dto).toMatchObject({
        title: 'Kelas',
        status: 'published',
        type: 'live-bootcamp',
        category: 'Sipil',
        level: 'Mahir',
        originalPrice: 150000,
      });
      expect(dto.discountedPrice).toBeUndefined();
      expect(await validate(dto)).toEqual([]);
    });

    it('leaves the status of a new class unset so it defaults to draft', () => {
      expect(plainToInstance(CreateClassDto, { title: 'Kelas' }).status).toBe(
        undefined,
      );
    });

    it('clears chapter and meeting text, and takes a numeric order', async () => {
      const chapter = plainToInstance(CreateChapterDto, {
        title: 'Bab 1',
        description: '',
        order: '2',
      });
      expect(chapter).toMatchObject({ description: null, order: 2 });
      expect(await validate(chapter)).toEqual([]);

      const update = plainToInstance(UpdateMeetingDto, {
        content: '  ',
        liveUrl: '',
        duration_minutes: '90',
      });
      expect(update).toMatchObject({
        content: null,
        liveUrl: null,
        duration_minutes: 90,
      });
      expect(await validate(update)).toEqual([]);
    });

    it.each([
      [UpdateChapterDto, { title: '' }, ['title']],
      [UpdateChapterDto, { title: null }, ['title']],
      [UpdateMeetingDto, { title: '  ' }, ['title']],
      [CreateMeetingDto, { ...meeting, title: '' }, ['title']],
      [
        CreateMeetingDto,
        { ...meeting, liveUrl: 'http://zoom.us/j/1' },
        ['liveUrl'],
      ],
      [CreateChapterDto, { title: 'Bab', order: null }, ['order']],
    ])('rejects %p %j', async (target, input, fields) => {
      expect(await errorFields(target as never, input)).toEqual(fields);
    });

    it('clears the check-in review and grading feedback', async () => {
      const checkIn = plainToInstance(CheckInDto, { review: '  ' });
      expect(checkIn.review).toBeNull();
      expect(await validate(checkIn)).toEqual([]);

      const grade = plainToInstance(GradeSubmissionDto, {
        feedback: '',
        score: '85',
      });
      expect(grade).toMatchObject({ feedback: null, score: 85 });
      expect(await validate(grade)).toEqual([]);
    });

    it('matches attendance status, tutor role and numbers case-insensitively', async () => {
      const status = plainToInstance(SetAttendanceStatusDto, {
        status: ' Hadir ',
      });
      expect(status.status).toBe(AttendanceStatus.HADIR);
      expect(await validate(status)).toEqual([]);

      const invite = plainToInstance(InviteMentorDto, {
        email: ' mentor@example.com ',
        role: 'Lead',
      });
      expect(invite).toMatchObject({
        email: 'mentor@example.com',
        role: 'lead',
      });
      expect(await validate(invite)).toEqual([]);

      const settings = plainToInstance(UpdateCertificateSettingsDto, {
        min_score: '75',
      });
      expect(settings.min_score).toBe(75);
      expect(await validate(settings)).toEqual([]);
    });

    it.each([
      [InviteMentorDto, { email: '', role: 'lead' }, ['email']],
      [InviteMentorDto, { email: 'a@b.co', role: 'owner' }, ['role']],
      [UpdateClassMentorDto, { role: null }, ['role']],
      [SetAttendanceStatusDto, { status: 'absen' }, ['status']],
      [UpdateCertificateSettingsDto, { min_score: null }, ['min_score']],
      [GradeSubmissionDto, { score: '101' }, ['score']],
    ])('rejects %p %j', async (target, input, fields) => {
      expect(await errorFields(target as never, input)).toEqual(fields);
    });
  });
});
