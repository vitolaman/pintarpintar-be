import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import {
  ObjectStorage,
  createObjectStorage,
} from '../../common/storage/object-storage';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';

export const MENTOR_DOCUMENT_PROVIDER = 's3';

export interface StoredMentorDocument {
  assetId: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export type MentorDocumentFiles = {
  cv?: Express.Multer.File[];
  skill_certificate?: Express.Multer.File[];
};

// Mentor CVs and certificates are private objects in the shared bucket; a
// container's local disk does not survive redeploys.
@Injectable()
export class MentorDocumentStorageService {
  private readonly logger = new Logger(MentorDocumentStorageService.name);
  private readonly maxBytes = 5 * 1024 * 1024;
  private readonly storage: ObjectStorage;

  constructor(configService: ConfigService) {
    this.storage = createObjectStorage(configService);
  }

  async storeRequiredDocuments(
    files: MentorDocumentFiles,
  ): Promise<{ cv: StoredMentorDocument; certificate: StoredMentorDocument }> {
    const cv = this.singleFile(files.cv, 'CV');
    const certificate = this.singleFile(
      files.skill_certificate,
      'Skill Certificate',
    );

    this.validate(cv, 'cv');
    this.validate(certificate, 'certificate');

    const stored: StoredMentorDocument[] = [];
    try {
      const storedCv = await this.store(cv);
      stored.push(storedCv);
      const storedCertificate = await this.store(certificate);
      stored.push(storedCertificate);
      return { cv: storedCv, certificate: storedCertificate };
    } catch (error) {
      await this.remove(stored);
      throw error;
    }
  }

  // Replacement accepts either document; at least one is required.
  async storeReplacementDocuments(files: MentorDocumentFiles): Promise<{
    cv?: StoredMentorDocument;
    certificate?: StoredMentorDocument;
  }> {
    const cv = files.cv?.[0];
    const certificate = files.skill_certificate?.[0];
    if (!cv && !certificate) {
      throw new BadRequestException(
        'Provide a CV and/or a Skill Certificate file',
      );
    }
    if (cv) this.validate(cv, 'cv');
    if (certificate) this.validate(certificate, 'certificate');

    const stored: StoredMentorDocument[] = [];
    try {
      const storedCv = cv ? await this.store(cv) : undefined;
      if (storedCv) stored.push(storedCv);
      const storedCertificate = certificate
        ? await this.store(certificate)
        : undefined;
      if (storedCertificate) stored.push(storedCertificate);
      return { cv: storedCv, certificate: storedCertificate };
    } catch (error) {
      await this.remove(stored);
      throw error;
    }
  }

  async remove(documents: { objectKey: string }[]): Promise<void> {
    await Promise.all(
      documents.map((document) =>
        this.storage.client
          .send(
            new DeleteObjectCommand({
              Bucket: this.storage.bucket,
              Key: document.objectKey,
            }),
          )
          .catch((error) =>
            this.logger.warn(
              `Could not delete mentor document ${document.objectKey}: ${error}`,
            ),
          ),
      ),
    );
  }

  signedDownloadUrl(objectKey: string, filename: string): Promise<string> {
    return signedDownloadUrl(this.storage, objectKey, filename);
  }

  private singleFile(
    files: Express.Multer.File[] | undefined,
    label: string,
  ): Express.Multer.File {
    const file = files?.[0];
    if (!file) throw new BadRequestException(`${label} file is required`);
    return file;
  }

  private validate(file: Express.Multer.File, kind: 'cv' | 'certificate') {
    if (!file.buffer?.length) {
      throw new BadRequestException(`${kind} file is empty`);
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException(`${kind} file must not exceed 5 MB`);
    }
    const allowed =
      kind === 'cv'
        ? new Set([
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ])
        : new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(`Invalid ${kind} file type`);
    }
    if (!this.hasExpectedSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(`Invalid ${kind} file content`);
    }
  }

  private async store(
    file: Express.Multer.File,
  ): Promise<StoredMentorDocument> {
    const assetId = randomUUID();
    const objectKey = `mentor-documents/${assetId}${this.extensionFor(file.mimetype)}`;
    try {
      await this.storage.client.send(
        new PutObjectCommand({
          Bucket: this.storage.bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not store mentor document ${objectKey}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException('Document storage is unavailable');
    }
    return {
      assetId,
      objectKey,
      originalFilename: file.originalname.slice(0, 255),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  private extensionFor(mimeType: string): string {
    const extensions: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'image/jpeg': '.jpg',
      'image/png': '.png',
    };
    const extension = extensions[mimeType];
    if (!extension) throw new BadRequestException('Unsupported document type');
    return extension;
  }

  private hasExpectedSignature(buffer: Buffer, mimeType: string): boolean {
    const signatures: Record<string, number[]> = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
      'application/msword': [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        [0x50, 0x4b, 0x03, 0x04],
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    };
    const signature = signatures[mimeType];
    return (
      !!signature && signature.every((byte, index) => buffer[index] === byte)
    );
  }
}
