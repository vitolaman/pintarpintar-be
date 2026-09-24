import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'user_notification_preferences' })
export class UserNotificationPreferences extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

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
