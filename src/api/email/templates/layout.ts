// Shared building blocks of every automatic email. Mail clients ignore
// stylesheets, so every style is inline and the layout is a 600 px table.
// Each block carries its HTML and its plain-text form, so both parts of an
// email always hold the same information.

const NAVY = '#1B2440';
const BLUE = '#3A7EF3';
const TEXT = '#3B4256';
const MUTED = '#6B7287';
const LINE = '#E3E7EF';
const SOFT = '#EEF4FE';
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export interface Block {
  html: string;
  text: string;
}

export interface EmailButton {
  label: string;
  url: string;
}

/** What a template returns; `layout` turns it into the final email. */
export interface EmailContent {
  subject: string;
  title: string;
  // Inbox preview line, shown next to the subject by most mail clients.
  preheader: string;
  blocks: Block[];
  button?: EmailButton;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export type ItemType = 'kelas' | 'bootcamp' | 'digital' | 'bundle';

export interface EmailLine {
  title: string;
  type: ItemType;
  merchant?: string;
  amount: number;
  instructions?: string | null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes text and keeps its line breaks. */
export function multiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

/** Rupiah with Indonesian thousands separators, e.g. Rp 150.000. */
export function rupiah(amount: number): string {
  const rounded = Math.round(Number(amount));
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}Rp ${digits}`;
}

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
// Asia/Jakarta has no daylight saving time.
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** A moment in Asia/Jakarta time, e.g. "5 Oktober 2026, 14.30 WIB". */
export function wib(moment: string | Date): string {
  const jakarta = new Date(new Date(moment).getTime() + JAKARTA_OFFSET_MS);
  const hours = String(jakarta.getUTCHours()).padStart(2, '0');
  const minutes = String(jakarta.getUTCMinutes()).padStart(2, '0');
  return `${jakarta.getUTCDate()} ${MONTHS[jakarta.getUTCMonth()]} ${jakarta.getUTCFullYear()}, ${hours}.${minutes} WIB`;
}

/** A calendar date (YYYY-MM-DD), e.g. "8 Oktober 2026". */
export function tanggal(date: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** A calendar month (YYYY-MM), e.g. "September 2026". */
export function bulan(month: string): string {
  const [year, number] = month.slice(0, 7).split('-').map(Number);
  return `${MONTHS[number - 1]} ${year}`;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  kelas: 'Kelas Video',
  bootcamp: 'Live Bootcamp',
  digital: 'Produk Digital',
  bundle: 'Bundling',
};

// Duitku payment method codes; an unknown code is shown as it is.
const PAYMENT_METHODS: Record<string, string> = {
  BC: 'BCA Virtual Account',
  M2: 'Mandiri Virtual Account',
  I1: 'BNI Virtual Account',
  BR: 'BRI Virtual Account',
  BT: 'Permata Virtual Account',
  B1: 'CIMB Niaga Virtual Account',
  A1: 'ATM Bersama',
  OV: 'OVO',
  SP: 'ShopeePay',
  DA: 'DANA',
  LA: 'LinkAja',
  NQ: 'QRIS',
  FT: 'Gerai Retail',
  VC: 'Kartu Kredit',
};

export function paymentMethodLabel(code: string | null): string {
  if (!code) return 'Gratis';
  return PAYMENT_METHODS[code] ?? code;
}

/** Frontend pages the emails link to, so a route change is one edit. */
export const FRONTEND_PATHS = {
  portal: '/portal-saya',
  cart: '/cart',
  sales: '/merchant/sales',
  balance: '/merchant/balance',
  merchantSettings: '/merchant/settings',
  merchantDashboard: '/merchant/dashboard',
  security: '/settings/security',
  login: '/login',
  resetPassword: '/reset-password',
  applications: '/mentor/progress-lamaran',
  mentorDashboard: '/mentor/dashboard',
  jobBoard: '/job-board',
  profile: '/profile',
  help: '/bantuan',
} as const;

export type FrontendPath = (typeof FRONTEND_PATHS)[keyof typeof FRONTEND_PATHS];

// ---------- Blocks ----------

/**
 * A paragraph. `html` must already be escaped; `text` is its plain form and
 * defaults to the same string when it has no markup.
 */
export function paragraph(html: string, text = html): Block {
  return {
    html: `<p style="margin:0 0 16px;font:15px/1.6 ${FONT};color:${TEXT};">${html}</p>`,
    text,
  };
}

/** A paragraph built from plain text only. */
export function plain(text: string): Block {
  return paragraph(escapeHtml(text), text);
}

export function greeting(name: string): Block {
  return plain(`Halo ${name},`);
}

/** Bold user text inside a paragraph: escaped HTML and its plain form. */
export function strong(value: string): { html: string; text: string } {
  return { html: `<b>${escapeHtml(value)}</b>`, text: value };
}

/** Label and value rows; values keep their line breaks. */
export function infoRows(rows: Array<[label: string, value: string]>): Block {
  const cell = `padding:8px 0;border-bottom:1px solid ${LINE};font:14px/1.4 ${FONT};vertical-align:top;`;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">${rows
      .map(
        ([label, value]) =>
          `<tr><td style="${cell}color:${MUTED};width:42%;">${escapeHtml(label)}</td><td style="${cell}color:${NAVY};font-weight:bold;">${multiline(value)}</td></tr>`,
      )
      .join('')}</table>`,
    text: rows.map(([label, value]) => `${label}: ${value}`).join('\n'),
  };
}

/** Purchased items with their amounts, an optional discount and a total. */
export function itemTable(
  lines: EmailLine[],
  totals: { discount?: number; totalLabel: string; total: number },
): Block {
  const rows = lines
    .map((line) => {
      const meta = `${ITEM_TYPE_LABELS[line.type]}${line.merchant ? ` · ${line.merchant}` : ''}`;
      return `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};vertical-align:top;"><div style="font:bold 15px/1.4 ${FONT};color:${NAVY};">${escapeHtml(line.title)}</div><div style="font:13px/1.5 ${FONT};color:${MUTED};">${escapeHtml(meta)}</div></td><td style="padding:12px 0 12px 12px;border-bottom:1px solid ${LINE};font:15px/1.4 ${FONT};color:${NAVY};text-align:right;white-space:nowrap;vertical-align:top;">${rupiah(line.amount)}</td></tr>`;
    })
    .join('');
  const discountRow = totals.discount
    ? `<tr><td style="padding:10px 0 0;font:14px/1.4 ${FONT};color:${MUTED};">Diskon</td><td style="padding:10px 0 0;font:14px/1.4 ${FONT};color:${MUTED};text-align:right;white-space:nowrap;">−${rupiah(totals.discount)}</td></tr>`
    : '';
  const totalRow = `<tr><td style="padding:10px 0 0;font:bold 15px/1.4 ${FONT};color:${NAVY};">${escapeHtml(totals.totalLabel)}</td><td style="padding:10px 0 0;font:bold 16px/1.4 ${FONT};color:${NAVY};text-align:right;white-space:nowrap;">${rupiah(totals.total)}</td></tr>`;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">${rows}${discountRow}${totalRow}</table>`,
    text: [
      ...lines.map(
        (line) =>
          `- ${line.title} (${ITEM_TYPE_LABELS[line.type]}${line.merchant ? `, ${line.merchant}` : ''}): ${rupiah(line.amount)}`,
      ),
      ...(totals.discount ? [`Diskon: -${rupiah(totals.discount)}`] : []),
      `${totals.totalLabel}: ${rupiah(totals.total)}`,
    ].join('\n'),
  };
}

/** A highlighted box, used for merchant instructions and notices. */
export function noteBox(title: string, body: string): Block {
  return {
    html: `<div style="margin:0 0 16px;padding:16px;background:${SOFT};border-radius:8px;"><div style="margin:0 0 6px;font:bold 14px/1.4 ${FONT};color:${NAVY};">${escapeHtml(title)}</div><div style="font:14px/1.6 ${FONT};color:${TEXT};">${multiline(body)}</div></div>`,
    text: `${title}\n${body}`,
  };
}

export function sectionHeading(title: string): Block {
  return {
    html: `<h2 style="margin:24px 0 12px;font:bold 16px/1.4 ${FONT};color:${NAVY};">${escapeHtml(title)}</h2>`,
    text: title.toUpperCase(),
  };
}

export function smallPrint(text: string): Block {
  return {
    html: `<p style="margin:0 0 16px;font:13px/1.6 ${FONT};color:${MUTED};">${escapeHtml(text)}</p>`,
    text,
  };
}

// ---------- Layout ----------

export function layout(
  content: EmailContent,
  frontendUrl: string,
  year = new Date().getFullYear(),
): RenderedEmail {
  const { button } = content;
  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${BLUE};"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 24px;font:bold 15px/1.2 ${FONT};color:#FFFFFF;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a></td></tr></table>`
    : '';
  const helpUrl = `${frontendUrl}${FRONTEND_PATHS.help}`;
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F9;">
<div style="margin:0;padding:24px 12px;background:#F3F5F9;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:12px;border-collapse:separate;">
<tr><td style="padding:28px 32px 8px;"><img src="${escapeHtml(frontendUrl)}/logo.png" width="96" alt="Pintar Pintar" style="display:block;border:0;height:auto;font:bold 18px ${FONT};color:${NAVY};"></td></tr>
<tr><td style="padding:16px 32px 8px;">
<h1 style="margin:0 0 20px;font:bold 22px/1.3 ${FONT};color:${NAVY};">${escapeHtml(content.title)}</h1>
${content.blocks.map((block) => block.html).join('\n')}
${buttonHtml}
</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid ${LINE};font:12px/1.6 ${FONT};color:${MUTED};">Email ini dikirim otomatis oleh Pintar Pintar. Butuh bantuan? Kunjungi <a href="${escapeHtml(helpUrl)}" style="color:${MUTED};">${escapeHtml(helpUrl.replace(/^https?:\/\//, ''))}</a>.<br>© ${year} Pintar Pintar</td></tr>
</table></div>
</body></html>`;
  const text = [
    content.title,
    '',
    content.blocks.map((block) => block.text).join('\n\n'),
    ...(button ? ['', `${button.label}: ${button.url}`] : []),
    '',
    '--',
    `Email ini dikirim otomatis oleh Pintar Pintar. Butuh bantuan? ${helpUrl}`,
  ].join('\n');
  return { subject: content.subject, html, text };
}
