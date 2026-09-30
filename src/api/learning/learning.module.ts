import { Module } from '@nestjs/common';
import { ClassModule } from '../../class/class.module';
import { LearningClassService } from './learning-class.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [ClassModule],
  controllers: [LearningController],
  providers: [LearningClassService],
})
export class LearningModule {}
