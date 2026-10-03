import { Controller, Get, NotFoundException, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginatedResponse } from '~/common/decorator/response.decorator';
import {
  LevelEvaluationQueryDto,
  LevelEvaluationResponseDto,
} from './dto/merchant-level.dto';
import { MerchantLevelService } from './merchant-level.service';

@Controller('api/v1/merchant')
@ApiBearerAuth()
@ApiTags('Merchant Levels')
export class MerchantLevelController {
  constructor(private readonly merchantLevels: MerchantLevelService) {}

  @Get('level-evaluations')
  @PaginatedResponse(
    LevelEvaluationResponseDto,
    'Get level evaluations success',
    [new NotFoundException('Merchant not found')],
  )
  findEvaluations(
    @Req() req: { user: { id: string } },
    @Query() query: LevelEvaluationQueryDto,
  ) {
    return this.merchantLevels.findOwnEvaluations(req.user.id, query);
  }
}
