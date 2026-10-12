import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ObjectStorage,
  createObjectStorage,
} from '../common/storage/object-storage';
import { signedDownloadUrl } from '../common/storage/signed-download-url';
import { assertOwnedAsset } from '../api/file-asset/asset-purpose-rules';
import { ClassAccessService } from './class-access.service';
import { UpdateCertificateSettingsDto } from './dto/certificate.dto';
import { Certificate, CertificateStatus } from './entities/certificate.entity';
import { ClassCertificateSettings } from './entities/class-certificate-settings.entity';
import { LearnerMetrics, loadLearnerMetrics } from './learner-metrics';
import { paginationMeta } from '../common/dto/response-meta.dto';
import { queueCertificateIssuedEmail } from '~/api/email/events/learning-emails';
import {
  CertificateRules,
  CertificateSettings,
  certificateRules,
  toCertificateSettings,
} from './certificate-settings';
import { nextPrefixedNumber } from './certificate-number';
import {
  CertificateClassContext,
  CertificateDelivery,
  certificateDelivery,
  loadCertificateClassContext,
} from './certificate-template';

export type LearnerCertificateStatus = 'issued' | 'pending' | 'ineligible';

export interface LearnerCertificateState {
  user_id: string;
  status: LearnerCertificateStatus;
  eligible: boolean;
  metrics: LearnerMetrics;
  // The class's non-deleted assignments; each needs a graded submission.
  assignment_count: number;
  certificate: Certificate | null;
}

// Eligible = progress 100%, attendance at least the minimum when the class has
// started meetings, and, when the class has assignments, a graded submission
// for every one of them with an average at least the minimum score (user
// decision 2026-10-06: there are no optional assignments). Only issued certificates are stored; pending and
// ineligible are computed.
export function isEligible(
  metrics: LearnerMetrics,
  settings: CertificateRules,
  assignmentCount: number,
): boolean {
  if (metrics.progress < 100) return false;
  if (
    metrics.started_meetings > 0 &&
    (metrics.attendance_percent ?? 0) < settings.min_attendance_percent
  ) {
    return false;
  }
  if (
    assignmentCount > 0 &&
    (metrics.graded_assignments < assignmentCount ||
      metrics.average_score === null ||
      metrics.average_score < settings.min_score)
  ) {
    return false;
  }
  return true;
}

export interface CertificateTemplateView {
  cert_no: string;
  issue_date: string;
  learner_name: string;
  class_name: string;
  merchant_name: string;
  merchant_logo_url: string | null;
  mentor_name: string | null;
  signature_url: string | null;
  show_score: boolean;
  final_score: number | null;
  verification_code: string;
}

export interface CertificateView {
  status: LearnerCertificateStatus;
  cert_no: string | null;
  issue_date: string | null;
  file_name: string | null;
  file_download_url: string | null;
  delivery: CertificateDelivery | null;
  certificate_url: string | null;
  template: CertificateTemplateView | null;
  progress: number;
  attendance_percent: number | null;
  average_score: number | null;
  graded_assignments: number;
  assignment_count: number;
  requirements: CertificateRules;
}

export interface CertificateSettingsView extends CertificateSettings {
  signature_url: string | null;
  default_class_name: string;
  default_mentor_name: string | null;
}

interface StoredFile {
  id: string;
  object_key: string;
  original_filename: string;
}

@Injectable()
export class ClassCertificateService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findCertificates(
    userId: string,
    classId: string,
    page = 1,
    limit = 10,
  ) {
    await this.classAccess.requireAction(
      userId,
      classId,
      'sertifikat',
      'lihat',
    );
    const manager = this.dataSource.manager;
    const [{ total }] = await manager.query(
      `SELECT count(*)::integer AS total FROM enrollments
       WHERE class_id = $1 AND deleted_at IS NULL`,
      [classId],
    );
    const learners: Array<{ user_id: string; name: string; email: string }> =
      await manager.query(
        `SELECT learner.id AS user_id, learner.name, learner.email
         FROM enrollments enrollment
         INNER JOIN users learner ON learner.id = enrollment.user_id
         WHERE enrollment.class_id = $1 AND enrollment.deleted_at IS NULL
         ORDER BY learner.name, learner.id
         LIMIT $2 OFFSET $3`,
        [classId, limit, (page - 1) * limit],
      );
    const settings = await this.loadSettings(manager, classId);
    const states =
      learners.length === 0
        ? []
        : await this.loadStates(
            manager,
            classId,
            learners.map((learner) => learner.user_id),
            settings,
          );
    const views = await this.toViews(manager, classId, states, settings);
    return {
      data: learners.map((learner) => ({
        ...learner,
        ...views[
          states.findIndex((state) => state.user_id === learner.user_id)
        ],
      })),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get class certificates success',
    };
  }

  // Manual issuing: only an eligible learner without a certificate.
  async issueManually(userId: string, classId: string, learnerId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'sertifikat',
        'tambah',
        manager,
      );
      const state = await this.lockLearnerState(manager, classId, learnerId);
      if (state.certificate) {
        throw new ConflictException('The certificate is already issued');
      }
      if (!state.eligible) {
        throw new BadRequestException(
          'The learner does not meet the certificate requirements yet',
        );
      }
      await this.issue(manager, classId, learnerId, userId);
      return this.learnerResponse(
        manager,
        classId,
        learnerId,
        'Issue certificate success',
      );
    });
  }

  async attachFile(
    userId: string,
    classId: string,
    learnerId: string,
    assetId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'sertifikat',
        'edit',
        manager,
      );
      const state = await this.lockLearnerState(manager, classId, learnerId);
      if (!state.certificate) {
        throw new NotFoundException('Certificate not found');
      }
      await assertOwnedAsset(manager, userId, assetId, 'certificate_file');
      await manager.update(
        Certificate,
        { id: state.certificate.id },
        { asset_id: assetId, updated_by: userId },
      );
      return this.learnerResponse(
        manager,
        classId,
        learnerId,
        'Attach certificate file success',
      );
    });
  }

  // A withdrawn certificate keeps its number; issuing again takes a new one.
  async withdraw(userId: string, classId: string, learnerId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'sertifikat',
        'delete',
        manager,
      );
      const state = await this.lockLearnerState(manager, classId, learnerId);
      if (!state.certificate) {
        throw new NotFoundException('Certificate not found');
      }
      await manager.update(
        Certificate,
        { id: state.certificate.id },
        { deleted_at: new Date(), deleted_by: userId },
      );
    });
  }

  private async lockLearnerState(
    manager: EntityManager,
    classId: string,
    learnerId: string,
  ): Promise<LearnerCertificateState> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `certificate:${classId}:${learnerId}`,
    ]);
    const [state] = await this.loadStates(manager, classId, [learnerId]);
    if (!state) throw new NotFoundException('Learner not found');
    return state;
  }

  private async learnerResponse(
    manager: EntityManager,
    classId: string,
    learnerId: string,
    responseMessage: string,
  ) {
    return {
      data: await this.findLearnerView(manager, classId, learnerId),
      responseMessage,
    };
  }

  // The learner's own certificate state for a class.
  async findLearnerView(
    manager: EntityManager,
    classId: string,
    userId: string,
  ): Promise<CertificateView | null> {
    const settings = await this.loadSettings(manager, classId);
    const [state] = await this.loadStates(manager, classId, [userId], settings);
    if (!state) return null;
    const [view] = await this.toViews(manager, classId, [state], settings);
    return view;
  }

  // Delivery details exist only for issued certificates, so a link or the
  // template data never reaches a learner before the requirements are met.
  async toViews(
    manager: EntityManager,
    classId: string,
    states: LearnerCertificateState[],
    settings: CertificateSettings,
  ): Promise<CertificateView[]> {
    const files = await this.loadFiles(
      manager,
      states
        .map((state) => state.certificate?.asset_id)
        .filter((id): id is string => Boolean(id)),
    );
    const deliveries = states.map((state) =>
      state.certificate
        ? certificateDelivery(
            settings.delivery_mode,
            files.some((file) => file.id === state.certificate?.asset_id),
          )
        : null,
    );
    const templateUserIds = states
      .filter((_, index) => deliveries[index] === 'template')
      .map((state) => state.user_id);
    const template =
      templateUserIds.length === 0
        ? null
        : await this.loadTemplateParts(
            manager,
            classId,
            templateUserIds,
            settings,
          );
    const rules = certificateRules(settings);
    return Promise.all(
      states.map(async (state, index) => {
        const file = files.find(
          (row) => row.id === state.certificate?.asset_id,
        );
        const delivery = deliveries[index];
        return {
          status: state.status,
          cert_no: state.certificate?.certNo ?? null,
          issue_date: state.certificate?.issueDate ?? null,
          file_name: file?.original_filename ?? null,
          file_download_url: file ? await this.fileUrl(file) : null,
          delivery,
          certificate_url:
            delivery === 'link' ? settings.certificate_url : null,
          template:
            delivery === 'template' && state.certificate && template
              ? this.templateView(state, state.certificate, settings, template)
              : null,
          progress: state.metrics.progress,
          attendance_percent: state.metrics.attendance_percent,
          average_score: state.metrics.average_score,
          graded_assignments: state.metrics.graded_assignments,
          assignment_count: state.assignment_count,
          requirements: rules,
        };
      }),
    );
  }

  private templateView(
    state: LearnerCertificateState,
    certificate: Certificate,
    settings: CertificateSettings,
    parts: TemplateParts,
  ): CertificateTemplateView {
    return {
      cert_no: certificate.certNo,
      issue_date: certificate.issueDate,
      learner_name: parts.learnerNames.get(state.user_id) ?? '',
      class_name: settings.class_name ?? parts.context?.class_title ?? '',
      merchant_name: parts.context?.merchant_name ?? '',
      merchant_logo_url: parts.context?.merchant_logo_url ?? null,
      mentor_name:
        settings.mentor_name ?? parts.context?.first_mentor_name ?? null,
      signature_url: parts.signatureUrl,
      show_score: settings.show_score,
      final_score: settings.show_score ? state.metrics.average_score : null,
      verification_code: certificate.verification_code,
    };
  }

  private async loadTemplateParts(
    manager: EntityManager,
    classId: string,
    userIds: string[],
    settings: CertificateSettings,
  ): Promise<TemplateParts> {
    const [context, learners, signatureUrl] = await Promise.all([
      loadCertificateClassContext(manager, classId),
      manager.query('SELECT id, name FROM users WHERE id = ANY($1::uuid[])', [
        userIds,
      ]) as Promise<Array<{ id: string; name: string }>>,
      this.signatureUrl(manager, settings.signature_asset_id),
    ]);
    return {
      context,
      learnerNames: new Map(learners.map((row) => [row.id, row.name])),
      signatureUrl,
    };
  }

  private async loadFiles(
    manager: EntityManager,
    assetIds: string[],
  ): Promise<StoredFile[]> {
    if (assetIds.length === 0) return [];
    return manager.query(
      `SELECT id, object_key, original_filename FROM file_assets
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [assetIds],
    );
  }

  private fileUrl(file: StoredFile): Promise<string> {
    return signedDownloadUrl(
      this.storage,
      file.object_key,
      file.original_filename,
    );
  }

  private async signatureUrl(
    manager: EntityManager,
    assetId: string | null,
  ): Promise<string | null> {
    if (!assetId) return null;
    const [file] = await this.loadFiles(manager, [assetId]);
    return file ? this.fileUrl(file) : null;
  }

  private async settingsView(
    manager: EntityManager,
    classId: string,
    settings: CertificateSettings,
  ): Promise<CertificateSettingsView> {
    const [context, signatureUrl] = await Promise.all([
      loadCertificateClassContext(manager, classId),
      this.signatureUrl(manager, settings.signature_asset_id),
    ]);
    return {
      ...settings,
      signature_url: signatureUrl,
      default_class_name: context?.class_title ?? '',
      default_mentor_name: context?.first_mentor_name ?? null,
    };
  }

  async findSettings(userId: string, classId: string) {
    await this.classAccess.requireAction(
      userId,
      classId,
      'sertifikat',
      'lihat',
    );
    const manager = this.dataSource.manager;
    return {
      data: await this.settingsView(
        manager,
        classId,
        await this.loadSettings(manager, classId),
      ),
      responseMessage: 'Get certificate settings success',
    };
  }

  async updateSettings(
    userId: string,
    classId: string,
    input: UpdateCertificateSettingsDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'sertifikat',
        'edit',
        manager,
      );
      const current = await this.loadSettings(manager, classId);
      const next = mergeSettings(current, input);
      if (next.delivery_mode === 'link' && !next.certificate_url) {
        throw new BadRequestException(
          'Add your certificate link (certificate_url) to use link mode',
        );
      }
      // Only a newly chosen signature is checked; keeping the saved one must
      // not fail because another tutor uploaded it.
      if (
        next.signature_asset_id &&
        next.signature_asset_id !== current.signature_asset_id
      ) {
        await assertOwnedAsset(
          manager,
          userId,
          next.signature_asset_id,
          'certificate_signature',
        );
      }
      await manager.upsert(
        ClassCertificateSettings,
        { class_id: classId, ...next },
        ['class_id'],
      );
      await this.issueEligible(manager, classId, undefined, userId);
      return {
        data: await this.settingsView(manager, classId, next),
        responseMessage: 'Update certificate settings success',
      };
    });
  }

  // Called in the same transaction as any change that can make learners
  // eligible (video completion or video changes, grading, an auto-scored
  // quiz, attendance, a deleted meeting or assignment, settings). Issues
  // nothing in manual mode.
  async issueEligible(
    manager: EntityManager,
    classId: string,
    userIds?: string[],
    issuedBy?: string,
  ): Promise<void> {
    const settings = await this.loadSettings(manager, classId);
    if (!settings.auto_issue) return;
    const states = await this.loadStates(manager, classId, userIds, settings);
    for (const state of states) {
      if (state.eligible && !state.certificate) {
        await this.issue(manager, classId, state.user_id, issuedBy, settings);
      }
    }
  }

  async loadStates(
    manager: EntityManager,
    classId: string,
    userIds?: string[],
    settings?: CertificateSettings,
  ): Promise<LearnerCertificateState[]> {
    const effective = settings ?? (await this.loadSettings(manager, classId));
    const [metrics, [{ assignments }], certificates] = await Promise.all([
      loadLearnerMetrics(manager, classId, userIds),
      manager.query(
        `SELECT count(*)::integer AS assignments FROM assignments
         WHERE class_id = $1 AND deleted_at IS NULL`,
        [classId],
      ),
      manager.find(Certificate, { where: { class_id: classId } }),
    ]);
    return metrics.map((metric) => {
      const certificate =
        certificates.find((row) => row.user_id === metric.user_id) ?? null;
      const eligible = isEligible(metric, effective, assignments);
      return {
        user_id: metric.user_id,
        eligible,
        metrics: metric,
        assignment_count: assignments,
        certificate,
        status: certificate ? 'issued' : eligible ? 'pending' : 'ineligible',
      };
    });
  }

  // Withdrawn rows keep their numbers, so numbers are never reused. The
  // unique (class, number) index is the backstop for the advisory locks.
  async issue(
    manager: EntityManager,
    classId: string,
    learnerId: string,
    issuedBy?: string,
    settings?: CertificateSettings,
  ): Promise<Certificate> {
    const effective = settings ?? (await this.loadSettings(manager, classId));
    const [{ year, today }] = await manager.query(
      `SELECT to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY') AS year,
              to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS today`,
    );
    const certNo = effective.number_prefix
      ? await this.nextClassNumber(manager, classId, effective.number_prefix)
      : await this.nextPlatformNumber(manager, year);
    const certificate = await manager.save(
      Certificate,
      manager.create(Certificate, {
        class_id: classId,
        user_id: learnerId,
        status: CertificateStatus.ISSUED,
        certNo,
        issueDate: today,
        created_by: issuedBy ?? null,
      }),
    );
    await queueCertificateIssuedEmail(manager, certificate.id);
    return certificate;
  }

  // PP-CERT-YYYY-NNNN, sequential per issue year across the platform.
  private async nextPlatformNumber(
    manager: EntityManager,
    year: string,
  ): Promise<string> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `certificate-number:${year}`,
    ]);
    const [{ last }] = await manager.query(
      `SELECT COALESCE(max(substring("certNo" FROM '^PP-CERT-' || $1 || '-([0-9]+)$')::integer), 0) AS last
       FROM certificates WHERE "certNo" LIKE 'PP-CERT-' || $1 || '-%'`,
      [year],
    );
    return `PP-CERT-${year}-${String(last + 1).padStart(4, '0')}`;
  }

  // PREFIX-NNNN, counted per class and prefix. The prefix is compared as
  // plain text, never as a pattern.
  private async nextClassNumber(
    manager: EntityManager,
    classId: string,
    prefix: string,
  ): Promise<string> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `certificate-number:class:${classId}`,
    ]);
    const rows: Array<{ certNo: string }> = await manager.query(
      `SELECT "certNo" FROM certificates
       WHERE class_id = $1 AND left("certNo", char_length($2) + 1) = $2 || '-'`,
      [classId, prefix],
    );
    return nextPrefixedNumber(
      prefix,
      rows.map((row) => row.certNo),
    );
  }

  async loadSettings(
    manager: EntityManager,
    classId: string,
  ): Promise<CertificateSettings> {
    return toCertificateSettings(
      await manager.findOneBy(ClassCertificateSettings, { class_id: classId }),
    );
  }
}

interface TemplateParts {
  context: CertificateClassContext | null;
  learnerNames: Map<string, string>;
  signatureUrl: string | null;
}

// An omitted field keeps its value; null (or blank text, which the DTO turns
// into null) clears a nullable one.
function mergeSettings(
  current: CertificateSettings,
  input: UpdateCertificateSettingsDto,
): CertificateSettings {
  const pick = <K extends keyof CertificateSettings>(
    key: K,
  ): CertificateSettings[K] => {
    const value = (input as Partial<CertificateSettings>)[key];
    return value === undefined
      ? current[key]
      : (value as CertificateSettings[K]);
  };
  return {
    auto_issue: pick('auto_issue'),
    min_attendance_percent: pick('min_attendance_percent'),
    min_score: pick('min_score'),
    delivery_mode: pick('delivery_mode'),
    certificate_url: pick('certificate_url'),
    number_prefix: pick('number_prefix'),
    class_name: pick('class_name'),
    mentor_name: pick('mentor_name'),
    signature_asset_id: pick('signature_asset_id'),
    show_score: pick('show_score'),
  };
}
