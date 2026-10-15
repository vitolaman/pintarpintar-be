import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'user_notification_preferences' })
export class UserNotificationPreferences extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'email_order_paid', type: 'boolean', default: true })
  emailOrderPaid: boolean;

  @Column({
    name: 'email_learner_announcement',
    type: 'boolean',
    default: true,
  })
  emailLearnerAnnouncement: boolean;

  @Column({
    name: 'email_application_submitted',
    type: 'boolean',
    default: true,
  })
  emailApplicationSubmitted: boolean;

  @Column({ name: 'email_merchant_registered', type: 'boolean', default: true })
  emailMerchantRegistered: boolean;

  @Column({ name: 'email_pro_paid', type: 'boolean', default: true })
  emailProPaid: boolean;

  @Column({ name: 'email_interview_scheduled', type: 'boolean', default: true })
  emailInterviewScheduled: boolean;

  @Column({ name: 'email_application_result', type: 'boolean', default: true })
  emailApplicationResult: boolean;

  @Column({ name: 'email_mentor_announcement', type: 'boolean', default: true })
  emailMentorAnnouncement: boolean;

  @Column({
    name: 'email_merchant_announcement',
    type: 'boolean',
    default: true,
  })
  emailMerchantAnnouncement: boolean;

  @Column({ name: 'email_cashflow_success', type: 'boolean', default: true })
  emailCashflowSuccess: boolean;

  @Column({ name: 'email_new_sale', default: true })
  emailNewSale: boolean;

  @Column({ name: 'email_new_applicant', default: true })
  emailNewApplicant: boolean;

  @Column({ name: 'email_new_review', default: true })
  emailNewReview: boolean;

  @Column({ name: 'email_weekly_report', default: true })
  emailWeeklyReport: boolean;

  @Column({ name: 'whatsapp_new_order', default: true })
  whatsappNewOrder: boolean;

  @Column({ name: 'whatsapp_payout_approved', default: true })
  whatsappPayoutApproved: boolean;

  @Column({ name: 'whatsapp_student_chat', default: false })
  whatsappStudentChat: boolean;

  @Column({ name: 'promotion_broadcast', default: true })
  promotionBroadcast: boolean;
}
