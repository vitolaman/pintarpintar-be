import { infoRows, plain, wib } from './layout';
import type {
  InternalCertificationRequestEmail,
  InternalHelpTicketEmail,
  InternalMerchantProRequestEmail,
} from './payloads';
import type { EmailTemplate } from './template';

type Requester = {
  request_id: string;
  requested_at: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
};

function requesterRows(request: Requester): Array<[string, string]> {
  return [
    ['ID permintaan', request.request_id],
    ['Waktu', wib(request.requested_at)],
    ['ID pengguna', request.user_id ?? 'Anonim'],
    ['Nama pengguna', request.user_name ?? '-'],
    ['Email pengguna', request.user_email ?? '-'],
  ];
}

export const internalHelpTicket: EmailTemplate<InternalHelpTicketEmail> = (
  request,
) => ({
  subject: 'Tiket bantuan baru',
  title: 'Tiket bantuan baru',
  preheader: 'Tiket bantuan baru memerlukan perhatian tim.',
  blocks: [
    plain('Tiket bantuan baru telah dikirim.'),
    infoRows([
      ...requesterRows(request),
      ['Jenis tiket', request.ticket_type],
      ['Pesan', request.message],
    ]),
  ],
});

export const internalMerchantProRequest: EmailTemplate<
  InternalMerchantProRequestEmail
> = (request) => ({
  subject: 'Permintaan merchant Pro baru',
  title: 'Permintaan merchant Pro baru',
  preheader: 'Permintaan merchant Pro baru memerlukan tindak lanjut.',
  blocks: [
    plain('Permintaan merchant Pro baru telah dikirim.'),
    infoRows([...requesterRows(request), ['Pesan', request.message ?? '-']]),
  ],
});

export const internalMerchantRegistrationRequest: EmailTemplate<
  InternalMerchantProRequestEmail
> = (request) => ({
  subject: 'Permintaan pendaftaran merchant baru',
  title: 'Permintaan pendaftaran merchant baru',
  preheader: 'Permintaan pendaftaran merchant memerlukan tindak lanjut.',
  blocks: [
    plain('Permintaan pendaftaran merchant baru telah dikirim.'),
    infoRows([...requesterRows(request), ['Pesan', request.message ?? '-']]),
  ],
});

export const internalCertificationRequest: EmailTemplate<
  InternalCertificationRequestEmail
> = (request) => ({
  subject: 'Permintaan sertifikasi baru',
  title: 'Permintaan sertifikasi baru',
  preheader: 'Permintaan sertifikasi baru memerlukan tindak lanjut.',
  blocks: [
    plain('Permintaan sertifikasi baru telah dikirim.'),
    infoRows([
      ...requesterRows(request),
      ['Nama organisasi', request.organization_name],
      ['Profil organisasi', request.organization_profile ?? '-'],
      ['Email organisasi', request.organization_email],
      ['Telepon organisasi', request.organization_phone],
    ]),
  ],
});
