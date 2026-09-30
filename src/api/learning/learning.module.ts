import { Module } from '@nestjs/common';
import { ClassModule } from '../../class/class.module';
import { LearningController } from './learning.controller';

@Module({
  imports: [ClassModule],
  controllers: [LearningController],
})
export class LearningModule {}
