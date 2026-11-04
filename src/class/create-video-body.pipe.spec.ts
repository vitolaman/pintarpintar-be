import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { CreateVideoBodyPipe } from './create-video-body.pipe';
import { CreateVideoDto, CreateVideosDto } from './dto/video.dto';

describe('CreateVideoBodyPipe', () => {
  const pipe = new CreateVideoBodyPipe();
  // A union body reaches the pipe as Object, which the global pipe skips.
  const metadata: ArgumentMetadata = { type: 'body', metatype: Object };
  const linkVideo = (title: string) => ({
    title,
    youtube_url: 'https://www.youtube.com/embed/abc',
  });

  const rejection = async (body: unknown) => {
    const error = await pipe.transform(body, metadata).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    return JSON.stringify((error as BadRequestException).getResponse());
  };

  it('validates one video exactly as before', async () => {
    const body = await pipe.transform(
      { ...linkVideo('  Intro  '), duration: '12:30' },
      metadata,
    );

    expect(body).toBeInstanceOf(CreateVideoDto);
    expect(body).toMatchObject({ title: 'Intro', duration: '12:30' });
  });

  it('validates a list, each item as a single video', async () => {
    const body = (await pipe.transform(
      { videos: [linkVideo(' Pembuka '), linkVideo('Bagian 1')] },
      metadata,
    )) as CreateVideosDto;

    expect(body).toBeInstanceOf(CreateVideosDto);
    expect(body.videos).toHaveLength(2);
    expect(body.videos[0]).toBeInstanceOf(CreateVideoDto);
    expect(body.videos.map((video) => video.title)).toEqual([
      'Pembuka',
      'Bagian 1',
    ]);
  });

  it('keeps the single-video rules for one video', async () => {
    expect(await rejection({ youtube_url: 'https://youtu.be/x' })).toContain(
      'title',
    );
    expect(await rejection({ ...linkVideo('Intro'), videoz: [] })).toContain(
      'property videoz should not exist',
    );
  });

  it.each([
    ['an empty list', { videos: [] }, 'videos must contain at least 1'],
    [
      '21 videos',
      { videos: Array.from({ length: 21 }, (_, i) => linkVideo(`V${i}`)) },
      'videos must contain no more than 20',
    ],
    [
      'a list mixed with single-video fields',
      { videos: [linkVideo('Intro')], title: 'Intro' },
      'property title should not exist',
    ],
    [
      'an item without a title',
      { videos: [linkVideo('Intro'), { youtube_url: 'https://youtu.be/x' }] },
      'videos.1.title',
    ],
    [
      'an item with an unknown field',
      { videos: [{ ...linkVideo('Intro'), url: 'https://youtu.be/x' }] },
      'videos.0.property url should not exist',
    ],
    [
      'an http link in an item',
      { videos: [{ title: 'Intro', youtube_url: 'http://youtu.be/x' }] },
      'videos.0.youtube_url',
    ],
    [
      'a list that is not an array',
      { videos: 'Intro' },
      'videos must be an array',
    ],
  ])('rejects %s', async (_name, body, fragment) => {
    expect(await rejection(body)).toContain(fragment);
  });

  it('rejects a bare array instead of `videos`', async () => {
    await rejection([linkVideo('Intro')]);
  });
});
