import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MentorDocumentStorageService } from './mentor-document-storage.service';

describe('MentorDocumentStorageService', () => {
  let send: jest.SpyInstance;
  let service: MentorDocumentStorageService;

  const file = (
    name: string,
    mimeType: string,
    body = Buffer.from('%PDF-1.7\n'),
  ) =>
    ({
      originalname: name,
      mimetype: mimeType,
      size: body.length,
      buffer: body,
    }) as Express.Multer.File;

  beforeEach(() => {
    send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const config = new ConfigService({
      AWS_S3_BUCKET_NAME: 'pp-bucket',
      AWS_REGION: 'auto',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    });
    service = new MentorDocumentStorageService(config);
  });

  afterEach(() => send.mockRestore());

  it('stores required documents privately with opaque asset keys', async () => {
    const stored = await service.storeRequiredDocuments({
      cv: [file('candidate.exe', 'application/pdf')],
      skill_certificate: [file('certificate.pdf', 'application/pdf')],
    });

    expect(stored.cv.objectKey).toMatch(/^mentor-documents\/[0-9a-f-]+\.pdf$/);
    expect(stored.certificate.objectKey).toMatch(
      /^mentor-documents\/[0-9a-f-]+\.pdf$/,
    );
    const puts = send.mock.calls.map(([command]) => command);
    expect(puts).toHaveLength(2);
    expect(puts[0]).toBeInstanceOf(PutObjectCommand);
    expect(puts[0].input).toMatchObject({
      Bucket: 'pp-bucket',
      Key: stored.cv.objectKey,
      ContentType: 'application/pdf',
    });
    expect(puts[0].input).not.toHaveProperty('ACL');
  });

  it('rejects a missing required document before storing anything', async () => {
    await expect(
      service.storeRequiredDocuments({
        cv: [file('cv.pdf', 'application/pdf')],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an unsupported CV MIME type', async () => {
    await expect(
      service.storeRequiredDocuments({
        cv: [file('cv.png', 'image/png')],
        skill_certificate: [file('certificate.pdf', 'application/pdf')],
      }),
    ).rejects.toThrow('Invalid cv file type');
  });

  it('removes the stored CV when the certificate upload fails', async () => {
    send
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('storage down'))
      .mockResolvedValue({} as never);

    await expect(
      service.storeRequiredDocuments({
        cv: [file('cv.pdf', 'application/pdf')],
        skill_certificate: [file('certificate.pdf', 'application/pdf')],
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(send.mock.calls[2][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('accepts a replacement of only one document', async () => {
    const stored = await service.storeReplacementDocuments({
      skill_certificate: [
        file(
          'cert.png',
          'image/png',
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ),
      ],
    });

    expect(stored.cv).toBeUndefined();
    expect(stored.certificate?.objectKey).toMatch(/\.png$/);
  });

  it('requires at least one replacement document', async () => {
    await expect(service.storeReplacementDocuments({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('signs a short-lived download URL for a private document', async () => {
    const url = await service.signedDownloadUrl(
      'mentor-documents/abc.pdf',
      'cv "final".pdf',
    );

    expect(url).toContain('mentor-documents/abc.pdf');
    expect(url).toContain('X-Amz-Expires=600');
    expect(url).toContain('response-content-disposition');
  });
});
