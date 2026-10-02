import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
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

@Controller('api/v1/discussions')
@ApiBearerAuth()
@ApiTags('Class Discussions')
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService) {}

  @Get('threads')
  @PaginatedResponse(DiscussionThreadDto, 'Get class threads success', [
    BadRequestException,
    NotFoundException,
  ])
  findThreads(
    @Req() req: AuthenticatedRequest,
    @Query() query: ThreadListQueryDto,
  ) {
    return this.discussionService.findThreads(
      req.user.id,
      query.class_id,
      query,
    );
  }

  @Post('threads')
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

  @Post('comments')
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
