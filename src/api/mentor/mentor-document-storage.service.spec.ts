import { BadRequestException } from '@nestjs/common';
import { access } from 'fs/promises';
import { MentorDocumentStorageService } from './mentor-document-storage.service';

describe('MentorDocumentStorageService', () => {
  const service = new MentorDocumentStorageService();
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

  it('stores required documents privately with opaque asset keys', async () => {
    const stored = await service.storeRequiredDocuments({
      cv: [file('candidate.exe', 'application/pdf')],
      skill_certificate: [file('certificate.pdf', 'application/pdf')],
    });

    await expect(access(stored.cv.absolutePath)).resolves.toBeUndefined();
    await expect(access(stored.certificate.absolutePath)).resolves.toBeUndefined();
    expect(stored.cv.objectKey).toMatch(/^mentor-documents\/.+\.pdf$/);
    expect(stored.certificate.objectKey).toMatch(/^mentor-documents\/.+\.pdf$/);
    expect(stored.cv.absolutePath).not.toContain('profile_pics');

    await service.remove([stored.cv, stored.certificate]);
  });

  it('rejects a missing required document before writing a file', async () => {
    await expect(
      service.storeRequiredDocuments({
        cv: [file('cv.pdf', 'application/pdf')],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported CV MIME type', async () => {
    await expect(
      service.storeRequiredDocuments({
        cv: [file('cv.png', 'image/png')],
        skill_certificate: [file('certificate.pdf', 'application/pdf')],
      }),
    ).rejects.toThrow('Invalid cv file type');
  });
});
