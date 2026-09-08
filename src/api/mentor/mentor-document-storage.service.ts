import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

export interface StoredMentorDocument {
  assetId: string;
  objectKey: string;
  absolutePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

@Injectable()
export class MentorDocumentStorageService {
  private readonly root = join(process.cwd(), 'mentor_documents');
  private readonly maxBytes = 5 * 1024 * 1024;

  async storeRequiredDocuments(files: {
    cv?: Express.Multer.File[];
    skill_certificate?: Express.Multer.File[];
  }): Promise<{ cv: StoredMentorDocument; certificate: StoredMentorDocument }> {
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

  async remove(documents: StoredMentorDocument[]): Promise<void> {
    await Promise.all(
      documents.map((document) =>
        rm(document.absolutePath, { force: true }).catch(() => undefined),
      ),
    );
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

  private async store(file: Express.Multer.File): Promise<StoredMentorDocument> {
    const assetId = randomUUID();
    const extension = this.extensionFor(file.mimetype);
    const objectKey = `mentor-documents/${assetId}${extension}`;
    const absolutePath = join(this.root, `${assetId}${extension}`);
    await mkdir(this.root, { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });
    return {
      assetId,
      objectKey,
      absolutePath,
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        0x50, 0x4b, 0x03, 0x04,
      ],
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    };
    const signature = signatures[mimeType];
    return !!signature && signature.every((byte, index) => buffer[index] === byte);
  }
}
