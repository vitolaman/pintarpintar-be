import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseLogger } from './database.logger';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { User } from '~/api/user/entities/user.entity';
import { FileAsset } from '~/api/profile/entities/file-asset.entity';
import { IssuedCertificate } from '~/api/profile/entities/issued-certificate.entity';
import { Product } from '~/api/profile/entities/product.entity';
import { Profile } from '~/api/profile/entities/profile.entity';
import { StudentProgress } from '~/api/profile/entities/student-progress.entity';
import { UserAccess } from '~/api/profile/entities/user-access.entity';
import { MerchantMember } from '~/api/merchant/entities/merchant-member.entity';
import { MerchantProfile } from '~/api/merchant/entities/merchant-profile.entity';
import { Merchant } from '~/api/merchant/entities/merchant.entity';
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

dotenvExpand.expand(dotenv.config({ path: process.env.ENV_FILE || '.env' }));
const isProduction = process.env.NODE_ENV == 'production';

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
    MerchantMember,
    MerchantProfile,
    Mentor,
    MentorProfile,
    Product,
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
  ],
  // Pintar Pintar starts from its own ERD baseline. Legacy template migrations
  // remain in `migrations/` as reference only and must never run on this database.
  migrations: [`${__dirname}/migrations/pintar-pintar/*.{js,ts}`],
  synchronize: true,
  migrationsRun: true,
  migrationsTransactionMode: 'each',
  logging: true,
  logger: isProduction
    ? new DatabaseLogger(new Logger('Database'), true)
    : 'advanced-console',
};

export const defaultDataSource = new DataSource(dataSourceOptions);
