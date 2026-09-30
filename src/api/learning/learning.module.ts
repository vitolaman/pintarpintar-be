import { Module } from '@nestjs/common';
import { ClassModule } from '../../class/class.module';
import { LearningAssignmentService } from './learning-assignment.service';
import { LearningAttendanceService } from './learning-attendance.service';
import { LearningClassService } from './learning-class.service';
import { LearningSubmissionService } from './learning-submission.service';
import { LearningProductService } from './learning-product.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [ClassModule],
  controllers: [LearningController],
  providers: [
    LearningClassService,
    LearningAssignmentService,
    LearningSubmissionService,
    LearningProductService,
    LearningAttendanceService,
  ],
})
export class LearningModule {}
