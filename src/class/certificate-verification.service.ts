import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CertificateStatus } from './entities/certificate.entity';
import { loadCertificateClassContext } from './certificate-template';
import { CertificateVerificationDto } from './dto/certificate-verification.dto';

export const CERTIFICATE_NOT_VERIFIED = new NotFoundException(
  'Certificate not found',
);

@Injectable()
export class CertificateVerificationService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // The QR code's lookup. Only issued certificates of live classes answer.
  async verify(code: string) {
    const manager = this.dataSource.manager;
    const [row]: Array<{
      class_id: string;
      cert_no: string;
      issue_date: string;
      learner_name: string;
      class_name: string | null;
      mentor_name: string | null;
      show_score: boolean | null;
      final_score: string | null;
    }> = await manager.query(
      `SELECT certificate.class_id, certificate."certNo" AS cert_no,
              certificate."issueDate"::text AS issue_date, learner.name AS learner_name,
              settings.class_name, settings.mentor_name, settings.show_score,
              graded.final_score
       FROM certificates certificate
       INNER JOIN classes class ON class.id = certificate.class_id AND class.deleted_at IS NULL
       INNER JOIN users learner ON learner.id = certificate.user_id
       LEFT JOIN class_certificate_settings settings
         ON settings.class_id = class.id AND settings.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT round(avg(submission.total_score), 1) AS final_score
         FROM submissions submission
         INNER JOIN assignments assignment
           ON assignment.id = submission.assignment_id AND assignment.deleted_at IS NULL
         WHERE assignment.class_id = class.id AND submission.user_id = certificate.user_id
           AND submission.deleted_at IS NULL AND submission.total_score IS NOT NULL
       ) graded ON settings.show_score
       WHERE certificate.verification_code = $1 AND certificate.status = $2
         AND certificate.deleted_at IS NULL`,
      [code, CertificateStatus.ISSUED],
    );
    if (!row) throw CERTIFICATE_NOT_VERIFIED;
    const context = await loadCertificateClassContext(manager, row.class_id);
    const data: CertificateVerificationDto = {
      cert_no: row.cert_no,
      issue_date: row.issue_date,
      learner_name: row.learner_name,
      class_name: row.class_name ?? context?.class_title ?? '',
      merchant_name: context?.merchant_name ?? '',
      merchant_logo_url: context?.merchant_logo_url ?? null,
      mentor_name: row.mentor_name ?? context?.first_mentor_name ?? null,
      final_score:
        row.show_score && row.final_score !== null
          ? Number(row.final_score)
          : null,
    };
    return { data, responseMessage: 'Verify certificate success' };
  }
}
