import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ObjectStorage,
  createObjectStorage,
} from '../common/storage/object-storage';
import { signedDownloadUrl } from '../common/storage/signed-download-url';
import { ClassAccessService } from './class-access.service';
import { UpdateCertificateSettingsDto } from './dto/certificate.dto';
import { Certificate, CertificateStatus } from './entities/certificate.entity';
import { ClassCertificateSettings } from './entities/class-certificate-settings.entity';
import { LearnerMetrics, loadLearnerMetrics } from './learner-metrics';

export interface CertificateSettings {
  auto_issue: boolean;
  min_attendance_percent: number;
  min_score: number;
}

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  auto_issue: false,
  min_attendance_percent: 80,
  min_score: 75,
};

export type LearnerCertificateStatus = 'issued' | 'pending' | 'ineligible';

export interface LearnerCertificateState {
  user_id: string;
  status: LearnerCertificateStatus;
  eligible: boolean;
  metrics: LearnerMetrics;
  certificate: Certificate | null;
}

// Eligible = progress 100%, attendance at least the minimum when the class has
// started meetings, and a graded average at least the minimum score when the
// class has assignments. Only issued certificates are stored; pending and
// ineligible are computed.
export function isEligible(
  metrics: LearnerMetrics,
  settings: CertificateSettings,
  classHasAssignments: boolean,
): boolean {
  if (metrics.progress < 100) return false;
  if (
    metrics.started_meetings > 0 &&
    (metrics.attendance_percent ?? 0) < settings.min_attendance_percent
  ) {
    return false;
  }
  if (
    classHasAssignments &&
    (metrics.average_score === null ||
      metrics.average_score < settings.min_score)
  ) {
    return false;
  }
  return true;
}

export interface CertificateView {
  status: LearnerCertificateStatus;
  cert_no: string | null;
  issue_date: string | null;
  file_name: string | null;
  file_download_url: string | null;
  progress: number;
  attendance_percent: number | null;
  average_score: number | null;
  requirements: CertificateSettings;
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

  // The learner's own certificate state for a class.
  async findLearnerView(
    manager: EntityManager,
    classId: string,
    userId: string,
  ): Promise<CertificateView | null> {
    const settings = await this.loadSettings(manager, classId);
    const [state] = await this.loadStates(manager, classId, [userId], settings);
    if (!state) return null;
    const [view] = await this.toViews(manager, [state], settings);
    return view;
  }

  async toViews(
    manager: EntityManager,
    states: LearnerCertificateState[],
    settings: CertificateSettings,
  ): Promise<CertificateView[]> {
    const assetIds = states
      .map((state) => state.certificate?.asset_id)
      .filter((id): id is string => Boolean(id));
    const assets: Array<{
      id: string;
      object_key: string;
      original_filename: string;
    }> =
      assetIds.length === 0
        ? []
        : await manager.query(
            `SELECT id, object_key, original_filename FROM file_assets
             WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
            [assetIds],
          );
    return Promise.all(
      states.map(async (state) => {
        const asset = assets.find(
          (row) => row.id === state.certificate?.asset_id,
        );
        return {
          status: state.status,
          cert_no: state.certificate?.certNo ?? null,
          issue_date: state.certificate?.issueDate ?? null,
          file_name: asset?.original_filename ?? null,
          file_download_url: asset
            ? await signedDownloadUrl(
                this.storage,
                asset.object_key,
                asset.original_filename,
              )
            : null,
          progress: state.metrics.progress,
          attendance_percent: state.metrics.attendance_percent,
          average_score: state.metrics.average_score,
          requirements: settings,
        };
      }),
    );
  }

  async findSettings(userId: string, classId: string) {
    await this.classAccess.requireAction(
      userId,
      classId,
      'sertifikat',
      'lihat',
    );
    return {
      data: await this.loadSettings(this.dataSource.manager, classId),
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
      await manager.upsert(
        ClassCertificateSettings,
        {
          class_id: classId,
          auto_issue: input.auto_issue ?? current.auto_issue,
          min_attendance_percent:
            input.min_attendance_percent ?? current.min_attendance_percent,
          min_score: input.min_score ?? current.min_score,
        },
        ['class_id'],
      );
      await this.issueEligible(manager, classId, undefined, userId);
      return {
        data: await this.loadSettings(manager, classId),
        responseMessage: 'Update certificate settings success',
      };
    });
  }

  // Called in the same transaction as any change that can make learners
  // eligible (completion, grading, attendance, settings). Issues nothing in
  // manual mode.
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
        await this.issue(manager, classId, state.user_id, issuedBy);
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
      const eligible = isEligible(metric, effective, assignments > 0);
      return {
        user_id: metric.user_id,
        eligible,
        metrics: metric,
        certificate,
        status: certificate ? 'issued' : eligible ? 'pending' : 'ineligible',
      };
    });
  }

  // Numbers are PP-CERT-YYYY-NNNN, sequential per issue year and never reused
  // (withdrawn rows keep theirs). The advisory lock serialises one year's
  // numbering; the unique index is the backstop.
  async issue(
    manager: EntityManager,
    classId: string,
    learnerId: string,
    issuedBy?: string,
  ): Promise<Certificate> {
    const [{ year, today }] = await manager.query(
      `SELECT to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY') AS year,
              to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS today`,
    );
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `certificate-number:${year}`,
    ]);
    const [{ last }] = await manager.query(
      `SELECT COALESCE(max(substring("certNo" FROM '^PP-CERT-' || $1 || '-([0-9]+)$')::integer), 0) AS last
       FROM certificates WHERE "certNo" LIKE 'PP-CERT-' || $1 || '-%'`,
      [year],
    );
    return manager.save(
      Certificate,
      manager.create(Certificate, {
        class_id: classId,
        user_id: learnerId,
        status: CertificateStatus.ISSUED,
        certNo: `PP-CERT-${year}-${String(last + 1).padStart(4, '0')}`,
        issueDate: today,
        created_by: issuedBy ?? null,
      }),
    );
  }

  async loadSettings(
    manager: EntityManager,
    classId: string,
  ): Promise<CertificateSettings> {
    const saved = await manager.findOneBy(ClassCertificateSettings, {
      class_id: classId,
    });
    return saved
      ? {
          auto_issue: saved.auto_issue,
          min_attendance_percent: saved.min_attendance_percent,
          min_score: saved.min_score,
        }
      : { ...DEFAULT_CERTIFICATE_SETTINGS };
  }
}
