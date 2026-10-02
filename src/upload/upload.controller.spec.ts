import { ForbiddenException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileAssetService } from '~/api/file-asset/file-asset.service';

const USER = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';

describe('UploadController', () => {
  const service = {
    initiateMultipartUpload: jest.fn(),
    getPresignedUrls: jest.fn(),
    completeMultipartUpload: jest.fn(),
  };
  const fileAssets = { registerCompleted: jest.fn() };
  const controller = new UploadController(
    service as unknown as UploadService,
    fileAssets as unknown as FileAssetService,
  );
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
    expect(fileAssets.registerCompleted).not.toHaveBeenCalled();
  });

  it('registers the completed upload and returns its asset_id', async () => {
    const key = `uploads/${USER}/1-a.pdf`;
    service.completeMultipartUpload.mockResolvedValue({
      key,
      location: 'https://bucket/a.pdf',
      bucket: 'bucket',
    });
    fileAssets.registerCompleted.mockResolvedValue({ id: 'asset-id' });

    await expect(
      controller.completeUpload(req, { key, uploadId: 'u', parts: [] }),
    ).resolves.toEqual({
      key,
      location: 'https://bucket/a.pdf',
      bucket: 'bucket',
      asset_id: 'asset-id',
    });
    expect(fileAssets.registerCompleted).toHaveBeenCalledWith(USER, key);
  });

  it('does not register when S3 fails to complete', async () => {
    const key = `uploads/${USER}/1-a.pdf`;
    service.completeMultipartUpload.mockRejectedValue(new Error('S3 down'));
    await expect(
      controller.completeUpload(req, { key, uploadId: 'u', parts: [] }),
    ).rejects.toThrow('S3 down');
    expect(fileAssets.registerCompleted).not.toHaveBeenCalled();
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
