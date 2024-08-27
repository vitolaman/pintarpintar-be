import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Predictions } from './entities/prediction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Predictions])],
  controllers: [PredictionController],
  providers: [PredictionService],
})
export class PredictionModule {}
