import { EntityManager } from 'typeorm';
import { assetUrl } from '../common/storage/asset-url';
import { CertificateDeliveryMode } from './certificate-settings';

export type CertificateDelivery = 'template' | 'link' | 'file';

// The class facts a template certificate shows besides the learner's own.
export interface CertificateClassContext {
  class_title: string;
  merchant_name: string;
  merchant_logo_url: string | null;
  // The class's first assigned mentor, as in the profile certificate list.
  first_mentor_name: string | null;
}

/**
 * A link-mode class always sends learners to its link; in template mode an
 * uploaded file wins, so certificates issued with files keep them.
 */
export function certificateDelivery(
  mode: CertificateDeliveryMode,
  hasFile: boolean,
): CertificateDelivery {
  if (mode === 'link') return 'link';
  return hasFile ? 'file' : 'template';
}

export async function loadCertificateClassContext(
  manager: EntityManager,
  classId: string,
): Promise<CertificateClassContext | null> {
  const [row]: Array<{
    class_title: string;
    merchant_name: string | null;
    logo_object_key: string | null;
    first_mentor_name: string | null;
  }> = await manager.query(
    `SELECT class.title AS class_title, merchant.store_name AS merchant_name,
            logo.object_key AS logo_object_key, lead_mentor.name AS first_mentor_name
     FROM classes class
     LEFT JOIN merchants merchant ON merchant.id = class.merchant_id
     LEFT JOIN merchant_profiles profile
       ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
     LEFT JOIN file_assets logo
       ON logo.id = profile.avatar_asset_id AND logo.deleted_at IS NULL
     LEFT JOIN LATERAL (
       SELECT mentor_user.name
       FROM class_mentors link
       INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
       INNER JOIN users mentor_user ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
       WHERE link.class_id = class.id AND link.deleted_at IS NULL
       ORDER BY link.created_at, link.id
       LIMIT 1
     ) lead_mentor ON true
     WHERE class.id = $1`,
    [classId],
  );
  if (!row) return null;
  return {
    class_title: row.class_title,
    merchant_name: row.merchant_name ?? '',
    merchant_logo_url: assetUrl(row.logo_object_key),
    first_mentor_name: row.first_mentor_name,
  };
}
