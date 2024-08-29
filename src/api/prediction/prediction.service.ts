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
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';
import { PredictionListResDto } from './dto/prediction-list.dto';

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

  async predictionList(
    { limit, page }: RequestPaginatedQueryWithSearchDto,
    userId: string,
  ): Promise<PredictionListResDto> {
    const queryBuilder = this.predictionRepo
      .createQueryBuilder('predictions')
      .where('predictions.user_id = :userId', { userId })
      .andWhere('predictions.deleted_at IS NULL')
      .select([
        'predictions.id as "predictionId"',
        'predictions.sport as "sport"',
        'predictions.category_id as "categoryId"',
        'predictions.match_id as "matchId"',
        'predictions.match_status as "matchStatus"',
        'predictions.prediction as "prediction"',
        'predictions.local_team_id as "localTeamId"',
        'predictions.visitor_team_id as "visitorTeamId"',
        'predictions.partner_data_json as "partnerDataJson"',
        'predictions.created_at as "createdAt"',
      ])
      .orderBy('predictions.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const rawResults = await queryBuilder.getRawMany();
    const total = await queryBuilder.getCount();

    const predictions = rawResults.map((result) => ({
      predictionId: result.predictionId,
      sport: result.sport,
      categoryId: result.categoryId,
      matchId: result.matchId,
      matchStatus: result.matchStatus,
      prediction: result.prediction,
      localTeamId: result.localTeamId,
      visitorTeamId: result.visitorTeamId,
      partnerDataJson: result.partnerDataJson,
      createdAt: result.createdAt,
    }));

    return new PredictionListResDto({
      data: predictions,
      responseMessage: 'Get Prediction list success',
      meta: {
        page,
        per_page: limit,
        total,
      },
    });
  }

  async detail(matchId: string, userId: string, res: Response) {
    const prediction = await this.predictionRepo
      .createQueryBuilder('predictions')
      .where('predictions.match_id = :matchId', { matchId })
      .andWhere('predictions.user_id = :userId', { userId })
      .andWhere('predictions.deleted_at IS NULL')
      .select([
        'predictions.id as "predictionId"',
        'predictions.sport as "sport"',
        'predictions.category_id as "categoryId"',
        'predictions.match_id as "matchId"',
        'predictions.match_status as "matchStatus"',
        'predictions.prediction as "prediction"',
        'predictions.local_team_id as "localTeamId"',
        'predictions.visitor_team_id as "visitorTeamId"',
        'predictions.partner_data_json as "partnerDataJson"',
        'predictions.created_at as "createdAt"',
      ])
      .orderBy('predictions.created_at', 'DESC')
      .getRawOne();

    if (!prediction) {
      return res.status(HttpStatus.NOT_FOUND).json({
        responseMessage: 'Prediction Not Found!',
      });
    }

    return res.status(HttpStatus.OK).json({
      data: prediction,
      responseMessage: 'Get Prediction detail success',
    });
  }
}
