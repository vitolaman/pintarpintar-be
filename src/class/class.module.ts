import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassService } from './class.service';
import { ClassAccessService } from './class-access.service';
import { ClassContentService } from './class-content.service';
import { ClassAssignmentService } from './class-assignment.service';
import { LearnerAccessService } from './learner-access.service';
import { LearningProgressService } from './learning-progress.service';
import { ClassGradingService } from './class-grading.service';
import { ClassAttendanceService } from './class-attendance.service';
import { ClassCertificateService } from './class-certificate.service';
import { ClassController } from './class.controller';
import { ClassDuplicationService } from './class-duplication.service';
import { ClassFaqController } from './class-faq.controller';
import { ClassFaqService } from './class-faq.service';
import { Class } from './entities/class.entity';
import { Chapter } from './entities/chapter.entity';
import { FileResource } from './entities/file-resource.entity';
import { Video } from './entities/video.entity';
import { Meeting } from './entities/meeting.entity';
import { Assignment } from './entities/assignment.entity';
import { AssignmentQuestion } from './entities/assignment-question.entity';
import { Submission } from './entities/submission.entity';
import { SubmissionAnswer } from './entities/submission-answer.entity';
import { Attendance } from './entities/attendance.entity';
import { Certificate } from './entities/certificate.entity';
import { DiscussionThread } from './entities/discussion-thread.entity';
import { Comment } from './entities/comment.entity';
import { ClassMentor } from './entities/class-mentor.entity';
import { Enrollment } from './entities/enrollment.entity';
import { VideoCompletion } from './entities/video-completion.entity';
import { ClassCertificateSettings } from './entities/class-certificate-settings.entity';
import { ClassFaq } from './entities/class-faq.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
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
      ClassFaq,
    ]),
  ],
  controllers: [ClassController, ClassFaqController],
  providers: [
    ClassService,
    ClassAccessService,
    ClassContentService,
    ClassAssignmentService,
    LearnerAccessService,
    LearningProgressService,
    ClassGradingService,
    ClassAttendanceService,
    ClassCertificateService,
    ClassFaqService,
    ClassDuplicationService,
  ],
  exports: [
    ClassService,
    ClassAccessService,
    LearnerAccessService,
    LearningProgressService,
    ClassAttendanceService,
    ClassCertificateService,
  ],
})
export class ClassModule {}
