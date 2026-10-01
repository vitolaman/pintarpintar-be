import { Module } from '@nestjs/common';
import { JobApplicationController } from './job-application.controller';
import { JobApplicationService } from './job-application.service';
import { JobPostingController } from './job-posting.controller';
import { JobPostingService } from './job-posting.service';
import { MentorRosterController } from './mentor-roster.controller';
import { MentorRosterService } from './mentor-roster.service';

@Module({
  controllers: [
    JobPostingController,
    JobApplicationController,
    MentorRosterController,
  ],
  providers: [JobPostingService, JobApplicationService, MentorRosterService],
})
export class RecruitmentModule {}
