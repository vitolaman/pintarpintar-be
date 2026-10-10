import { Module } from '@nestjs/common';
import { PlatformReviewController } from './platform-review.controller';
import { PlatformReviewService } from './platform-review.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  controllers: [ReviewController, PlatformReviewController],
  providers: [ReviewService, PlatformReviewService],
})
export class ReviewModule {}
