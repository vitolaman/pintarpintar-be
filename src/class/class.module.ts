import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
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
    ]),
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
