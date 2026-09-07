import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'user_notification_preferences' })
export class UserNotificationPreferences extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'email_new_sale' })
  emailNewSale: boolean;

  @Column({ name: 'email_new_applicant' })
  emailNewApplicant: boolean;

  @Column({ name: 'email_new_review' })
  emailNewReview: boolean;

  @Column({ name: 'email_weekly_report' })
  emailWeeklyReport: boolean;

  @Column({ name: 'whatsapp_new_order' })
  whatsappNewOrder: boolean;

  @Column({ name: 'whatsapp_payout_approved' })
  whatsappPayoutApproved: boolean;

  @Column({ name: 'whatsapp_student_chat' })
  whatsappStudentChat: boolean;

  @Column({ name: 'promotion_broadcast' })
  promotionBroadcast: boolean;
}
