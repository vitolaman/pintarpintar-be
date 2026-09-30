import { ForbiddenException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

const USER = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';

describe('UploadController', () => {
  const service = {
    initiateMultipartUpload: jest.fn(),
    getPresignedUrls: jest.fn(),
    completeMultipartUpload: jest.fn(),
  };
  const controller = new UploadController(service as unknown as UploadService);
  const req = { user: { id: USER } };

  beforeEach(() => jest.clearAllMocks());

  it('initiates with the caller id', async () => {
    await controller.initiateUpload(req, {
      fileName: 'a.pdf',
      contentType: 'application/pdf',
    });
    expect(service.initiateMultipartUpload).toHaveBeenCalledWith(
      USER,
      'a.pdf',
      'application/pdf',
    );
  });

  it("refuses to presign or complete another user's key", async () => {
    const key = `uploads/${OTHER}/1-a.pdf`;
    await expect(
      controller.getPresignedUrls(req, { key, uploadId: 'u', partsCount: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.completeUpload(req, { key, uploadId: 'u', parts: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getPresignedUrls).not.toHaveBeenCalled();
    expect(service.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('presigns the caller own key', async () => {
    const key = `uploads/${USER}/1-a.pdf`;
    await controller.getPresignedUrls(req, {
      key,
      uploadId: 'u',
      partsCount: 2,
    });
    expect(service.getPresignedUrls).toHaveBeenCalledWith(key, 'u', 2);
  });
});
