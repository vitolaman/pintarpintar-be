import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassListQueryDto } from './class-list-query.dto';
import { CreateClassDto } from './create-class.dto';
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
    [{}, []],
  ])('update %j fails on %j', async (input, fields) => {
    expect(await errorFields(UpdateClassDto, input)).toEqual(fields);
  });

  it.each([
    [{ title: 'Kelas', originalPrice: -1 }, ['originalPrice']],
    [{ title: '' }, ['title']],
    [{ title: 'Kelas', cover_asset_id: 'x' }, ['cover_asset_id']],
    [{ title: 'Kelas', originalPrice: 100000, discountedPrice: 90000 }, []],
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
});
