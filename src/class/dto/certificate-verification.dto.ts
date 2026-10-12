import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Public details only: no email, user id or signature.
export class CertificateVerificationDto {
  @ApiProperty({ example: 'CIVIL-0001' }) cert_no: string;
  @ApiProperty({ example: '2026-10-12' }) issue_date: string;
  @ApiProperty() learner_name: string;
  @ApiProperty({ description: 'The certificate class name or the class title' })
  class_name: string;
  @ApiProperty() merchant_name: string;
  @ApiPropertyOptional({ nullable: true }) merchant_logo_url: string | null;
  @ApiPropertyOptional({ nullable: true }) mentor_name: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Only when the class shows scores on its certificates',
  })
  final_score: number | null;
}
