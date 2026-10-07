import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseLogger, RedactingConsoleLogger } from './database.logger';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { User } from '~/api/user/entities/user.entity';
import { FileAsset } from '~/api/profile/entities/file-asset.entity';
import { IssuedCertificate } from '~/api/profile/entities/issued-certificate.entity';
import { Product } from '~/api/profile/entities/product.entity';
import { Category } from '~/api/digital-product/entities/category.entity';
import { DigitalFile } from '~/api/digital-product/entities/digital-file.entity';
import { ProductCategory } from '~/api/digital-product/entities/product-category.entity';
import { MerchantSkill } from '~/api/merchant/entities/merchant-skill.entity';
import { Profile } from '~/api/profile/entities/profile.entity';
import { StudentProgress } from '~/api/profile/entities/student-progress.entity';
import { UserAccess } from '~/api/profile/entities/user-access.entity';
import { MerchantMember } from '~/api/merchant/entities/merchant-member.entity';
import { MerchantProfile } from '~/api/merchant/entities/merchant-profile.entity';
import { Merchant } from '~/api/merchant/entities/merchant.entity';
import { MerchantPayout } from '~/api/merchant/entities/merchant-payout.entity';
import { MerchantWallet } from '~/api/merchant/entities/merchant-wallet.entity';
import { Bundle } from '~/api/bundle/entities/bundle.entity';
import { BundleItem } from '~/api/bundle/entities/bundle-item.entity';
import { CartItem } from '~/api/cart/entities/cart-item.entity';
import { Order } from '~/api/order/entities/order.entity';
import { WishlistItem } from '~/api/wishlist/entities/wishlist-item.entity';
import { OrderItem } from '~/api/order/entities/order-item.entity';
import { MerchantPayoutAccount } from '~/api/payout-account/entities/merchant-payout-account.entity';
import { UserNotificationPreferences } from '~/api/merchant/entities/user-notification-preferences.entity';
import { Mentor } from '~/api/mentor/entities/mentor.entity';
import { MentorProfile } from '~/api/mentor/entities/mentor-profile.entity';
import { Class } from '~/class/entities/class.entity';
import { Chapter } from '~/class/entities/chapter.entity';
import { FileResource } from '~/class/entities/file-resource.entity';
import { Video } from '~/class/entities/video.entity';
import { Meeting } from '~/class/entities/meeting.entity';
import { Assignment } from '~/class/entities/assignment.entity';
import { AssignmentQuestion } from '~/class/entities/assignment-question.entity';
import { Submission } from '~/class/entities/submission.entity';
import { SubmissionAnswer } from '~/class/entities/submission-answer.entity';
import { Attendance } from '~/class/entities/attendance.entity';
import { Certificate } from '~/class/entities/certificate.entity';
import { DiscussionThread } from '~/class/entities/discussion-thread.entity';
import { Comment } from '~/class/entities/comment.entity';
import { ClassMentor } from '~/class/entities/class-mentor.entity';
import { Enrollment } from '~/class/entities/enrollment.entity';
import { VideoCompletion } from '~/class/entities/video-completion.entity';
import { ClassCertificateSettings } from '~/class/entities/class-certificate-settings.entity';
import { Discount } from '~/api/discount/entities/discount.entity';
import { DiscountCode } from '~/api/discount/entities/discount-code.entity';
import { DiscountProduct } from '~/api/discount/entities/discount-product.entity';
import { CouponUsage } from '~/api/voucher/entities/coupon-usage.entity';
import { Voucher } from '~/api/voucher/entities/voucher.entity';
import { HelpTicket } from '~/api/help-ticket/entities/help-ticket.entity';
import { FaqCategory } from '~/api/faq/entities/faq-category.entity';
import { Faq } from '~/api/faq/entities/faq.entity';
import { Review } from '~/api/review/entities/review.entity';
import { ReviewHelpfulVote } from '~/api/review/entities/review-helpful-vote.entity';
import { ReviewReply } from '~/api/review/entities/review-reply.entity';
import { ProPlan } from '~/api/pro/entities/pro-plan.entity';
import { MerchantProPeriod } from '~/api/pro/entities/merchant-pro-period.entity';
import { JobApplication } from '~/api/recruitment/entities/job-application.entity';
import { JobPosting } from '~/api/recruitment/entities/job-posting.entity';
import { MerchantMentor } from '~/api/recruitment/entities/merchant-mentor.entity';
import { MerchantVisit } from '~/api/merchant-dashboard/entities/merchant-visit.entity';
import { ClassFaq } from '~/class/entities/class-faq.entity';
import { MerchantLevelEvaluation } from '~/api/merchant-level/entities/merchant-level-evaluation.entity';
import { Notification } from '~/api/notification/entities/notification.entity';
import { ItemCoverImage } from '~/api/item-cover/entities/item-cover-image.entity';
import { SavedJobPosting } from '~/api/recruitment/entities/saved-job-posting.entity';
import { MerchantDailyStat } from '~/api/merchant-income/entities/merchant-daily-stat.entity';
import { EmailOutbox } from '~/api/email/entities/email-outbox.entity';
import { PasswordResetToken } from '~/api/auth/entities/password-reset-token.entity';
import type { LoggerOptions } from 'typeorm/logger/LoggerOptions';

dotenvExpand.expand(dotenv.config({ path: process.env.ENV_FILE || '.env' }));
const isProduction = process.env.NODE_ENV == 'production';
// TypeORM reports a successful migration through the 'schema' log.
const PRODUCTION_LOGGING: LoggerOptions = [
  'error',
  'warn',
  'schema',
  'migration',
];
const SLOW_QUERY_MS = 400;

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [
    FileAsset,
    IssuedCertificate,
    Merchant,
    MerchantWallet,
    MerchantPayout,
    Order,
    OrderItem,
    Bundle,
    BundleItem,
    WishlistItem,
    CartItem,
    MerchantPayoutAccount,
    MerchantMember,
    MerchantProfile,
    Mentor,
    MentorProfile,
    Product,
    Category,
    DigitalFile,
    ProductCategory,
    MerchantSkill,
    Profile,
    StudentProgress,
    User,
    UserAccess,
    UserNotificationPreferences,
    Class,
    Chapter,
    FileResource,
    Video,
    Meeting,
    Assignment,
    AssignmentQuestion,
    Submission,
    SubmissionAnswer,
    Attendance,
    Certificate,
    DiscussionThread,
    Comment,
    ClassMentor,
    Enrollment,
    VideoCompletion,
    ClassCertificateSettings,
    Voucher,
    CouponUsage,
    Discount,
    DiscountProduct,
    DiscountCode,
    HelpTicket,
    FaqCategory,
    Faq,
    Review,
    JobPosting,
    JobApplication,
    MerchantMentor,
    MerchantVisit,
    ClassFaq,
    MerchantLevelEvaluation,
    Notification,
    ItemCoverImage,
    SavedJobPosting,
    MerchantDailyStat,
    EmailOutbox,
    PasswordResetToken,
    ReviewHelpfulVote,
    ReviewReply,
    ProPlan,
    MerchantProPeriod,
  ],
  // Pintar Pintar starts from its own ERD baseline. Legacy template migrations
  // remain in `migrations/` as reference only and must never run on this database.
  migrations: [`${__dirname}/migrations/pintar-pintar/*.{js,ts}`],
  // Schema changes are delivered only through recorded project migrations.
  // Runtime synchronization reshaped the shared schema and must stay disabled.
  synchronize: false,
  migrationsRun: true,
  migrationsTransactionMode: 'each',
  // Production logs failures, slow statements, warnings and migrations, never
  // parameter values; development logs every statement for debugging.
  logging: isProduction ? PRODUCTION_LOGGING : true,
  logger: isProduction
    ? new DatabaseLogger(new Logger('Database'), PRODUCTION_LOGGING, {
        withParameters: false,
      })
    : new RedactingConsoleLogger(true),
  // The PM's latency flag for one call (ms); slower statements are logged.
  maxQueryExecutionTime: isProduction ? SLOW_QUERY_MS : undefined,
};

export const defaultDataSource = new DataSource(dataSourceOptions);
