import { Controller, Post, Body, Req, Res, HttpStatus } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { Response } from 'express';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';

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
}
