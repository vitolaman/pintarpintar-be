import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { FaqCategory } from './entities/faq-category.entity';
import { Faq } from './entities/faq.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FaqCategory, Faq])],
  controllers: [FaqController],
  providers: [FaqService],
})
export class FaqModule {}
