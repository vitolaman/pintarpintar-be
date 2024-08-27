import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Predictions } from './entities/prediction.entity';
import { Repository } from 'typeorm';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { User } from '../user/entities/user.entity';
import { Response } from 'express';
import { predictionMatchStatus } from './prediction.constant';

@Injectable()
export class PredictionService {
  constructor(
    @InjectRepository(Predictions)
    private predictionRepo: Repository<Predictions>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(body: CreatePredictionDto, userId: string, res: Response) {
    const queryRunner = this.userRepo.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Cek predict_token_user
      const user = await this.userRepo.findOneBy({ id: userId });

      if (user.predictToken == 0) {
        return res.status(HttpStatus.FORBIDDEN).json({
          responseMessage: 'Cant predict, You have no predict token left',
        });
      }

      // Cek duplicate prediction
      const dupPrediction = await this.predictionRepo.findOneBy({
        userId,
        matchId: body.matchId,
        categoryId: body.categoryId,
        sport: body.sport,
      });

      if (dupPrediction) {
        return res.status(HttpStatus.CONFLICT).json({
          responseMessage: 'Can only predict same match once',
        });
      }

      // Create Prediction if able
      const prediction = {
        userId,
        sport: body.sport,
        categoryId: body.categoryId,
        matchId: body.matchId,
        matchStatus: predictionMatchStatus.PENDING,
        prediction: parseInt(body.prediction),
        localTeamId: body.localTeamId,
        visitorTeamId: body.visitorTeamId,
      } as Predictions;

      await queryRunner.manager.save(this.predictionRepo.create(prediction));

      // Update the predict_token in user table
      user.predictToken = user.predictToken - 1;
      await this.userRepo.save(user);

      // Todo: Get detail from partner API and store to DB (Masih belum ketemu cara dpt in detail selain cricket)

      await queryRunner.commitTransaction();

      return res.status(HttpStatus.OK).json({
        responseMessage: `Create Prediction Success`,
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException();
    } finally {
      await queryRunner.release();
    }
  }
}
