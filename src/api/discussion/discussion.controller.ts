import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { DiscussionService } from './discussion.service';
import {
  CreateCommentDto,
  CreateThreadDto,
  DiscussionCommentDto,
  DiscussionThreadDto,
  ThreadListQueryDto,
} from './dto/discussion.dto';

type AuthenticatedRequest = { user: { id: string } };

@Controller('discussions/v1')
@ApiBearerAuth()
@ApiTags('Class Discussions')
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService) {}

  @Get('get-threads/:classId')
  @PaginatedResponse(DiscussionThreadDto, 'Get class threads success', [
    BadRequestException,
    NotFoundException,
  ])
  findThreads(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: ThreadListQueryDto,
  ) {
    return this.discussionService.findThreads(req.user.id, classId, query);
  }

  @Post('create-thread')
  @DefaultResponse(
    DiscussionThreadDto,
    'Create thread success',
    HttpStatus.CREATED,
    [BadRequestException, ForbiddenException, NotFoundException],
  )
  createThread(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateThreadDto,
  ) {
    return this.discussionService.createThread(req.user.id, input);
  }

  @Post('create-comment')
  @DefaultResponse(
    DiscussionCommentDto,
    'Create comment success',
    HttpStatus.CREATED,
    [BadRequestException, NotFoundException],
  )
  createComment(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateCommentDto,
  ) {
    return this.discussionService.createComment(req.user.id, input);
  }
}
