import { ClassCertificateSettings } from './entities/class-certificate-settings.entity';

export const CERTIFICATE_DELIVERY_MODES = ['template', 'link'] as const;
export type CertificateDeliveryMode =
  (typeof CERTIFICATE_DELIVERY_MODES)[number];

// The former issuing rules: still saved and returned, with no effect
// (owner decision 2026-10-23: the merchant decides).
export interface CertificateRules {
  auto_issue: boolean;
  min_attendance_percent: number;
  min_score: number;
}

export interface CertificateSettings extends CertificateRules {
  delivery_mode: CertificateDeliveryMode;
  certificate_url: string | null;
  number_prefix: string | null;
  // Overrides shown on the template; null falls back to the class title and
  // the class's first mentor.
  class_name: string | null;
  mentor_name: string | null;
  signature_asset_id: string | null;
  show_score: boolean;
}

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  auto_issue: false,
  min_attendance_percent: 80,
  min_score: 75,
  delivery_mode: 'template',
  certificate_url: null,
  number_prefix: null,
  class_name: null,
  mentor_name: null,
  signature_asset_id: null,
  show_score: false,
};

export function certificateRules(
  settings: CertificateSettings,
): CertificateRules {
  return {
    auto_issue: settings.auto_issue,
    min_attendance_percent: settings.min_attendance_percent,
    min_score: settings.min_score,
  };
}

export function toCertificateSettings(
  saved: ClassCertificateSettings | null,
): CertificateSettings {
  if (!saved) return { ...DEFAULT_CERTIFICATE_SETTINGS };
  return {
    auto_issue: saved.auto_issue,
    min_attendance_percent: saved.min_attendance_percent,
    min_score: saved.min_score,
    delivery_mode: saved.delivery_mode,
    certificate_url: saved.certificate_url,
    number_prefix: saved.number_prefix,
    class_name: saved.class_name,
    mentor_name: saved.mentor_name,
    signature_asset_id: saved.signature_asset_id,
    show_score: saved.show_score,
  };
}
