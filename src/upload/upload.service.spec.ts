import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
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

  it('maps storage failures to 500', async () => {
    send.mockRejectedValue(new Error('network'));
    await expect(
      service.initiateMultipartUpload(USER, 'a.pdf', 'application/pdf'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
