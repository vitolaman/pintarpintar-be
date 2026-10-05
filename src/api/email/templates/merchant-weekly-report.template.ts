import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  itemTable,
  paragraph,
  rupiah,
  sectionHeading,
  strong,
  tanggal,
} from './layout';
import type { MerchantWeeklyReportEmail } from './payloads';
import type { EmailTemplate } from './template';

/** "naik 27% dari minggu lalu (Rp 980.000)", or why there is no percentage. */
export function weeklyChange(revenue: number, previous: number): string {
  if (previous <= 0) return 'minggu lalu belum ada pendapatan';
  if (revenue === previous) return 'sama dengan minggu lalu';
  const percent = Math.abs(Math.round(((revenue - previous) / previous) * 100));
  const direction = revenue > previous ? 'naik' : 'turun';
  return `${direction} ${percent}% dari minggu lalu (${rupiah(previous)})`;
}

export const merchantWeeklyReport: EmailTemplate<MerchantWeeklyReportEmail> = (
  report,
  link,
) => {
  const range = `${tanggal(report.week_start)} – ${tanggal(report.week_end)}`;
  const change = weeklyChange(report.revenue, report.previous_revenue);
  const store = strong(report.store_name);
  const reviews =
    report.new_reviews && report.average_rating !== null
      ? `${report.new_reviews} (rata-rata ${String(report.average_rating).replace('.', ',')} / 5)`
      : 'Belum ada';
  return {
    subject: `Laporan mingguan ${report.store_name}: ${range}`,
    title: 'Laporan mingguan',
    preheader: `Pendapatan bersih ${rupiah(report.revenue)}, ${change}.`,
    blocks: [
      greeting(report.owner_name),
      paragraph(
        `Ringkasan ${store.html} untuk ${range}.`,
        `Ringkasan ${store.text} untuk ${range}.`,
      ),
      infoRows([
        ['Pendapatan bersih', `${rupiah(report.revenue)}\n${change}`],
        ['Transaksi', String(report.transactions)],
        ['Pembeli', String(report.buyers)],
        ['Ulasan baru', reviews],
        ['Saldo bisa ditarik', rupiah(report.withdrawable_balance)],
      ]),
      ...(report.top_items.length
        ? [
            sectionHeading('Paling laris'),
            itemTable(
              report.top_items.map((item) => ({
                title: `${item.title} (${item.sold}×)`,
                type: item.type,
                amount: item.amount,
              })),
            ),
          ]
        : []),
    ],
    button: {
      label: 'Buka dashboard',
      url: link(FRONTEND_PATHS.merchantDashboard),
    },
  };
};
