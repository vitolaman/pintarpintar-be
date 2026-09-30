import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { LearningProgressService } from '../../class/learning-progress.service';
import {
  LearnerProgressResponseDto,
  LearningClassResponseDto,
} from './dto/learning-response.dto';
import { LearningClassService } from './learning-class.service';

type AuthenticatedRequest = { user: { id: string } };

// Routes for learners using what they bought. Every route requires an active
// enrollment (or product access) and answers 404 otherwise.
@Controller('learning/v1')
@ApiBearerAuth()
@ApiTags('Learning')
export class LearningController {
  constructor(
    private readonly learningProgress: LearningProgressService,
    private readonly learningClass: LearningClassService,
  ) {}

  @Get('get-class/:id')
  @DefaultResponse(
    LearningClassResponseDto,
    'Get learning class success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findClass(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learningClass.findClass(req.user.id, id);
  }

  @Post('complete-video/:videoId')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    LearnerProgressResponseDto,
    'Complete video success',
    HttpStatus.OK,
    [NotFoundException],
  )
  completeVideo(
    @Req() req: AuthenticatedRequest,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.learningProgress.completeVideo(req.user.id, videoId);
  }
}
