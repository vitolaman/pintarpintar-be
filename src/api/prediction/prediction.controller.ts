import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { predictionDetailDto } from './dto/prediction-detail.dto';

@Controller('prediction')
@ApiBearerAuth()
@ApiTags('Prediction')
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Post('/create')
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'FORBIDDEN',
    schema: {
      example: {
        responseMessage: 'Cant predict, You have no predict token left',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'CONFLICT',
    schema: {
      example: {
        responseMessage: 'Can only predict same match once',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Create Prediction Success',
      },
    },
  })
  async create(
    @Req() req,
    @Body() createPredictionDto: CreatePredictionDto,
    @Res() res: Response,
  ) {
    return await this.predictionService.create(
      createPredictionDto,
      req.user.id,
      res,
    );
  }

  @Get('prediction-list')
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        data: [
          {
            predictionId: '0f241626-3111-4ef0-92dc-648a034c1f17',
            sport: '1',
            categoryId: '1',
            matchId: '1',
            matchStatus: 0,
            prediction: 1,
            localTeamId: '1',
            visitorTeamId: '1',
            partnerDataJson: null,
            createdAt: '2024-08-29T06:57:20.152Z',
          },
          {
            predictionId: 'bd050ed4-354d-405a-a15b-8b10894d87bb',
            sport: 'soccernew',
            categoryId: '1513',
            matchId: '5531758',
            matchStatus: 0,
            prediction: 1,
            localTeamId: '12287',
            visitorTeamId: '140685',
            partnerDataJson: null,
            createdAt: '2024-08-26T07:27:46.276Z',
          },
        ],
        meta: {
          page: 1,
          per_page: 10,
          total: 2,
          total_page: 1,
        },
        responseMessage: 'Get Prediction list success',
      },
    },
  })
  async predictionList(@Req() req, @Query() query: RequestPaginatedQueryDto) {
    return this.predictionService.predictionList(query, req.user.id);
  }

  @Get('detail')
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        data: {
          predictionId: 'bd050ed4-354d-405a-a15b-8b10894d87bb',
          sport: 'soccernew',
          categoryId: '1513',
          matchId: '5531758',
          matchStatus: 0,
          prediction: 1,
          localTeamId: '12287',
          visitorTeamId: '140685',
          partnerDataJson: null,
          createdAt: '2024-08-26T07:27:46.276Z',
        },
        responseMessage: 'Get Prediction detail success',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found',
    schema: {
      example: {
        responseMessage: 'Prediction Not Found!',
      },
    },
  })
  async predictionDetail(
    @Req() req,
    @Query() query: predictionDetailDto,
    @Res() res: Response,
  ) {
    return this.predictionService.detail(query.matchId, req.user.id, res);
  }
}
