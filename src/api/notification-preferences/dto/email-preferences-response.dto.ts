import { ApiProperty } from '@nestjs/swagger';

export class EmailPreferencesResponseDto {
  @ApiProperty({
    default: true,
    description: 'User: Konfirmasi Pembayaran Berhasil, including free orders.',
  })
  email_order_paid: boolean;

  @ApiProperty({
    default: true,
    description: 'User: Pengumuman Baru di Portal Saya, received as a learner.',
  })
  email_learner_announcement: boolean;

  @ApiProperty({
    default: true,
    description: 'User: Konfirmasi Lamaran sebagai Mentor.',
  })
  email_application_submitted: boolean;

  @ApiProperty({
    default: true,
    description:
      'User: Konfirmasi Pendaftaran Merchant Berhasil. One confirmation after immediate registration.',
  })
  email_merchant_registered: boolean;

  @ApiProperty({
    default: true,
    description: 'User: Konfirmasi Pendaftaran Pro Berhasil.',
  })
  email_pro_paid: boolean;

  @ApiProperty({
    default: true,
    description: 'Mentor: Konfirmasi Wawancara Mentor, including reschedules.',
  })
  email_interview_scheduled: boolean;

  @ApiProperty({
    default: true,
    description: 'Mentor: Hasil Lamaran Mentor, accepted or rejected.',
  })
  email_application_result: boolean;

  @ApiProperty({
    default: true,
    description:
      'Mentor: Pengumuman Baru di Portal Saya dari Merchant, received as a class tutor.',
  })
  email_mentor_announcement: boolean;

  @ApiProperty({
    default: true,
    description: 'Merchant: Transaksi Baru dari Pelanggan.',
  })
  email_new_sale: boolean;

  @ApiProperty({
    default: true,
    description: 'Merchant: Lamaran Baru dari Mentor.',
  })
  email_new_applicant: boolean;

  @ApiProperty({
    default: true,
    description:
      'Merchant: Pengumuman Baru di Portal Saya dari Mentor, received as the class owner.',
  })
  email_merchant_announcement: boolean;

  @ApiProperty({
    default: true,
    description:
      'Merchant: Konfirmasi Cashflow Berhasil. Both settlement-ready and withdrawal-success emails.',
  })
  email_cashflow_success: boolean;
}
