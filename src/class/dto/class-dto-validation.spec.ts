import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassListQueryDto } from './class-list-query.dto';
import { CreateClassDto } from './create-class.dto';
import { CreateMeetingDto } from './create-meeting.dto';
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
    [{ title: 'Kelas', level: 'pemula' }, ['level']],
    [
      { title: 'Kelas', learning_outcomes: 'Membuat denah' },
      ['learning_outcomes'],
    ],
  ])('create %j fails on %j', async (input, fields) => {
    expect(await errorFields(CreateClassDto, input)).toEqual(fields);
  });

  it.each([
    [{ limit: '101' }, ['limit']],
    [{ type: 'kelas-video' }, ['type']],
    [{ status: 'unlisted' }, ['status']],
    [{ page: '0' }, ['page']],
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
});
