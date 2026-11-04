import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateVideosDto, UpdateVideoDto } from './video.dto';

// The application's validation pipe (src/main.ts), so unknown fields such as
// `source` are rejected the way the API rejects them.
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const asBody = (metatype: typeof CreateVideosDto | typeof UpdateVideoDto) =>
  ({ type: 'body', metatype }) as const;
const link = 'https://www.youtube.com/embed/abc';
const assetId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const createBody = (body: unknown) =>
  pipe.transform(body, asBody(CreateVideosDto)) as Promise<CreateVideosDto>;
const updateBody = (body: unknown) =>
  pipe.transform(body, asBody(UpdateVideoDto)) as Promise<UpdateVideoDto>;
const rejection = async (work: Promise<unknown>) => {
  const error = await work.catch((e) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  return JSON.stringify((error as BadRequestException).getResponse());
};

describe('video request DTOs', () => {
  it.each([null, '', '   '])(
    'treats asset_id %j next to a link as not sent',
    async (empty) => {
      const { videos } = await createBody({
        videos: [{ title: 'Pembuka', youtube_url: link, asset_id: empty }],
      });
      expect(videos[0].asset_id).toBeUndefined();
      expect(videos[0].youtube_url).toBe(link);
    },
  );

  it.each([null, '', '   '])(
    'treats youtube_url %j next to an upload as not sent',
    async (empty) => {
      const { videos } = await createBody({
        videos: [{ title: 'Bagian 1', asset_id: assetId, youtube_url: empty }],
      });
      expect(videos[0].youtube_url).toBeUndefined();
      expect(videos[0].asset_id).toBe(assetId);
    },
  );

  it('keeps one video as a list of one', async () => {
    const body = await createBody({
      videos: [{ title: ' Pembuka ', youtube_url: ` ${link} ` }],
    });
    expect(body.videos).toEqual([
      expect.objectContaining({ title: 'Pembuka', youtube_url: link }),
    ]);
  });

  it.each([
    [
      'a single-video body',
      { title: 'Pembuka', youtube_url: link },
      'property title should not exist',
    ],
    [
      'source in a video',
      { videos: [{ title: 'Pembuka', source: 'link', youtube_url: link }] },
      'videos.0.property source should not exist',
    ],
    ['an empty list', { videos: [] }, 'videos must contain at least 1'],
    [
      '21 videos',
      {
        videos: Array.from({ length: 21 }, (_, i) => ({
          title: `V${i}`,
          youtube_url: link,
        })),
      },
      'videos must contain no more than 20',
    ],
    [
      'a filled asset_id that is not a UUID',
      { videos: [{ title: 'Bagian 1', asset_id: 'abc' }] },
      'videos.0.asset_id must be a UUID',
    ],
    [
      'an http link',
      { videos: [{ title: 'Pembuka', youtube_url: 'http://youtu.be/x' }] },
      'videos.0.youtube_url must be a URL address',
    ],
    ['a bare array', [{ title: 'Pembuka', youtube_url: link }], 'videos'],
  ])('rejects %s on create', async (_name, body, fragment) => {
    expect(await rejection(createBody(body))).toContain(fragment);
  });

  it('treats empty source fields on update as "keep the current one"', async () => {
    const body = await updateBody({
      title: 'Baru',
      youtube_url: '',
      asset_id: null,
    });
    expect(body.youtube_url).toBeUndefined();
    expect(body.asset_id).toBeUndefined();
    expect(body.title).toBe('Baru');
  });

  it('switches with the other field filled and this one empty', async () => {
    const body = await updateBody({ asset_id: assetId, youtube_url: null });
    expect(body).toEqual(expect.objectContaining({ asset_id: assetId }));
    expect(body.youtube_url).toBeUndefined();
  });

  it('rejects source on update', async () => {
    expect(
      await rejection(updateBody({ source: 'file', asset_id: assetId })),
    ).toContain('property source should not exist');
  });
});
