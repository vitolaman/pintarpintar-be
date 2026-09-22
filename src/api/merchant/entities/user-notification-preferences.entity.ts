import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'user_notification_preferences' })
export class UserNotificationPreferences extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'email_new_sale', default: false })
  emailNewSale: boolean;

  @Column({ name: 'email_new_applicant', default: false })
  emailNewApplicant: boolean;

  @Column({ name: 'email_new_review', default: false })
  emailNewReview: boolean;

  @Column({ name: 'email_weekly_report', default: false })
  emailWeeklyReport: boolean;

  @Column({ name: 'whatsapp_new_order', default: false })
  whatsappNewOrder: boolean;

  @Column({ name: 'whatsapp_payout_approved', default: false })
  whatsappPayoutApproved: boolean;

  @Column({ name: 'whatsapp_student_chat', default: false })
  whatsappStudentChat: boolean;

  @Column({ name: 'promotion_broadcast', default: false })
  promotionBroadcast: boolean;
}
