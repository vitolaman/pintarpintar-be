import { MerchantStorageLevel } from '~/api/merchant/entities/merchant.entity';
import {
  GOLD_MONTHLY_REVENUE,
  MERCHANT_LEVEL_RULES,
  SILVER_MONTHLY_REVENUE,
} from '~/api/merchant-level/merchant-level-rules';
import {
  bulan,
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  plain,
  rupiah,
  strong,
} from './layout';
import type { MerchantLevel, MerchantLevelResultEmail } from './payloads';
import type { EmailTemplate } from './template';

const ORDER: MerchantLevel[] = ['basic', 'silver', 'gold'];
const GIBIBYTE = 1024 ** 3;
const gigabytes = (bytes: number) => `${bytes / GIBIBYTE} GB`;

function nextStep(level: MerchantLevel): string {
  if (level === 'gold') {
    return `Toko kamu ada di level tertinggi. Pertahankan transaksi minimal ${rupiah(GOLD_MONTHLY_REVENUE)} per bulan.`;
  }
  if (level === 'silver') {
    return `Capai transaksi ${rupiah(GOLD_MONTHLY_REVENUE)} dalam sebulan untuk naik ke Gold.`;
  }
  return `Capai transaksi ${rupiah(SILVER_MONTHLY_REVENUE)} dalam sebulan untuk naik ke Silver.`;
}

export const merchantLevelResult: EmailTemplate<MerchantLevelResultEmail> = (
  result,
  link,
) => {
  const before =
    MERCHANT_LEVEL_RULES[result.level_before as MerchantStorageLevel];
  const after =
    MERCHANT_LEVEL_RULES[result.level_after as MerchantStorageLevel];
  const move =
    ORDER.indexOf(result.level_after) - ORDER.indexOf(result.level_before);
  const lead =
    move > 0
      ? `Selamat, level toko kamu naik ke ${after.label}!`
      : move < 0
        ? `Level toko kamu turun ke ${after.label}.`
        : `Level toko kamu tetap ${after.label}.`;
  const month = bulan(result.month);
  const store = strong(result.store_name);
  const revenue = rupiah(result.revenue);
  return {
    subject: `Level merchant ${month}: ${after.label}`,
    title: `Hasil level ${month}`,
    preheader: lead,
    blocks: [
      greeting(result.owner_name),
      paragraph(
        `${lead} Total transaksi ${store.html} bulan ${month} adalah <b>${revenue}</b>.`,
        `${lead} Total transaksi ${store.text} bulan ${month} adalah ${revenue}.`,
      ),
      infoRows([
        ['Level sebelumnya', before.label],
        ['Level sekarang', after.label],
        ['Maksimum upload per file', gigabytes(after.maxUploadBytes)],
        ['Total storage', gigabytes(after.storageQuotaBytes)],
      ]),
      plain(nextStep(result.level_after)),
    ],
    button: {
      label: 'Buka dashboard',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};
