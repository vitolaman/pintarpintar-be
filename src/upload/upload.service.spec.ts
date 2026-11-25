import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListMultipartUploadsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadService } from './upload.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(
    async (_client, command) =>
      `https://s3.test/${command.input.Key}?part=${command.input.PartNumber}`,
  ),
}));

const USER = '30000000-0000-4000-8000-000000000001';

describe('UploadService', () => {
  let send: jest.SpyInstance;
  let service: UploadService;

  beforeEach(() => {
    send = jest.spyOn(S3Client.prototype, 'send');
    service = new UploadService(
      new ConfigService({
        AWS_S3_BUCKET_NAME: 'bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'id',
        AWS_SECRET_ACCESS_KEY: 'secret',
      }),
    );
  });

  afterEach(() => send.mockRestore());

  it("starts an upload under the uploader's prefix", async () => {
    send.mockImplementation(async (command: CreateMultipartUploadCommand) => ({
      UploadId: 'upload-1',
      Key: command.input.Key,
    }));

    const result = await service.initiateMultipartUpload(
      USER,
      'denah lantai.dwg',
      'application/acad',
    );

    expect(result.uploadId).toBe('upload-1');
    expect(result.key).toMatch(
      new RegExp(`^uploads/${USER}/\\d+-denah_lantai\\.dwg$`),
    );
  });

  describe('content disposition', () => {
    const startedWith = async (contentType: string) => {
      send.mockResolvedValue({ UploadId: 'upload-1', Key: 'k' });
      await service.initiateMultipartUpload(USER, 'file', contentType);
      return (send.mock.calls[0][0] as CreateMultipartUploadCommand).input;
    };

    it.each([
      'text/html',
      'image/svg+xml',
      'application/x-msdownload',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])('stores %s as a download', async (contentType) => {
      const input = await startedWith(contentType);

      expect(input.ContentDisposition).toBe('attachment');
      expect(input.ContentType).toBe(contentType);
    });

    it.each([
      'image/jpeg',
      'image/png',
      'video/mp4',
      'audio/mpeg',
      'application/pdf',
      'IMAGE/PNG; charset=x',
    ])('keeps %s inline', async (contentType) => {
      const input = await startedWith(contentType);

      expect(input.ContentDisposition).toBeUndefined();
      expect(input.ContentType).toBe(contentType);
    });
  });

  it('presigns one URL per part', async () => {
    const urls = await service.getPresignedUrls('uploads/k', 'upload-1', 3);

    expect(urls.map((url) => url.partNumber)).toEqual([1, 2, 3]);
    expect(getSignedUrl).toHaveBeenCalledTimes(3);
  });

  it('completes with parts sorted by number', async () => {
    send.mockImplementation(
      async (command: CompleteMultipartUploadCommand) => ({
        Key: command.input.Key,
        Location: 'https://s3.test/uploads/k',
        Bucket: 'bucket',
        parts: command.input.MultipartUpload.Parts,
      }),
    );

    await service.completeMultipartUpload('uploads/k', 'upload-1', [
      { PartNumber: 2, ETag: 'b' },
      { PartNumber: 1, ETag: 'a' },
    ]);

    const command = send.mock.calls[0][0] as CompleteMultipartUploadCommand;
    expect(
      command.input.MultipartUpload.Parts.map((p) => p.PartNumber),
    ).toEqual([1, 2]);
  });

  it('aborts the upload when completing fails', async () => {
    send.mockImplementation(async (command) => {
      if (command instanceof CompleteMultipartUploadCommand) {
        throw new Error('InvalidPart');
      }
      return {};
    });

    await expect(
      service.completeMultipartUpload('uploads/k', 'upload-1', [
        { PartNumber: 1, ETag: '' },
      ]),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    const abort = send.mock.calls[1][0] as AbortMultipartUploadCommand;
    expect(abort).toBeInstanceOf(AbortMultipartUploadCommand);
    expect(abort.input).toEqual({
      Bucket: 'bucket',
      Key: 'uploads/k',
      UploadId: 'upload-1',
    });
  });

  it('still answers 500 when the abort fails too', async () => {
    send.mockRejectedValue(new Error('network'));
    await expect(
      service.completeMultipartUpload('uploads/k', 'upload-1', []),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  describe('stale upload cleanup', () => {
    const now = new Date('2026-11-25T00:00:00Z');
    const hoursAgo = (hours: number) =>
      new Date(now.getTime() - hours * 3_600_000);
    const aborted = () =>
      send.mock.calls
        .map(([command]) => command)
        .filter((command) => command instanceof AbortMultipartUploadCommand)
        .map((command) => command.input.UploadId);

    it('aborts uploads started more than a day ago, across pages', async () => {
      send.mockImplementation(async (command) => {
        if (!(command instanceof ListMultipartUploadsCommand)) return {};
        expect(command.input.Prefix).toBe('uploads/');
        if (!command.input.KeyMarker) {
          return {
            IsTruncated: true,
            NextKeyMarker: 'uploads/b',
            NextUploadIdMarker: 'old-1',
            Uploads: [
              { Key: 'uploads/a', UploadId: 'recent', Initiated: hoursAgo(2) },
              { Key: 'uploads/b', UploadId: 'old-1', Initiated: hoursAgo(25) },
            ],
          };
        }
        return {
          IsTruncated: false,
          Uploads: [
            { Key: 'uploads/c', UploadId: 'old-2', Initiated: hoursAgo(72) },
          ],
        };
      });

      await expect(service.abortStaleUploads(now)).resolves.toBe(2);
      expect(aborted()).toEqual(['old-1', 'old-2']);
    });

    it('logs and stops when storage cannot list uploads', async () => {
      send.mockRejectedValue(new Error('AccessDenied'));
      await expect(service.abortStaleUploads(now)).resolves.toBe(0);
    });

    it('does not count an abort that failed', async () => {
      send.mockImplementation(async (command) => {
        if (command instanceof AbortMultipartUploadCommand) {
          throw new Error('NoSuchUpload');
        }
        return {
          IsTruncated: false,
          Uploads: [
            { Key: 'uploads/b', UploadId: 'old', Initiated: hoursAgo(30) },
          ],
        };
      });
      await expect(service.abortStaleUploads(now)).resolves.toBe(0);
    });
  });

  it('maps storage failures to 500', async () => {
    send.mockRejectedValue(new Error('network'));
    await expect(
      service.initiateMultipartUpload(USER, 'a.pdf', 'application/pdf'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
