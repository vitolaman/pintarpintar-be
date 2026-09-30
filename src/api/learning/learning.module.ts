import { Module } from '@nestjs/common';
import { ClassModule } from '../../class/class.module';
import { LearningAssignmentService } from './learning-assignment.service';
import { LearningClassService } from './learning-class.service';
import { LearningSubmissionService } from './learning-submission.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [ClassModule],
  controllers: [LearningController],
  providers: [
    LearningClassService,
    LearningAssignmentService,
    LearningSubmissionService,
  ],
})
export class LearningModule {}
