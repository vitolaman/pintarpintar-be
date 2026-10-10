import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  DefaultResponse,
  EmptyResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import {
  GROUP_NOT_FOUND,
  JOIN_TO_POST,
  JOIN_TO_READ,
  REPLY_NOT_FOUND,
  THREAD_NOT_FOUND,
} from './community-access';
import {
  AUTHOR_OR_OWNER,
  CommunityThreadService,
  EMPTY_THREAD,
} from './community-thread.service';
import {
  CommunityLikeResponseDto,
  CommunityReplyResponseDto,
  CommunityThreadDetailDto,
  CommunityThreadFeedQueryDto,
  CommunityThreadResponseDto,
  CreateCommunityReplyDto,
  CreateCommunityThreadDto,
} from './dto/community-thread.dto';

type OptionalUser = { user?: { id: string } };
type SignedIn = { user: { id: string } };

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Community')
export class CommunityThreadController {
  constructor(private readonly threads: CommunityThreadService) {}

  // Public groups are readable without a token; request-only ones by members.
  @Get('community-threads')
  @Public()
  @PaginatedResponse(
    CommunityThreadResponseDto,
    'Get community threads success',
    [
      BadRequestException,
      new ForbiddenException(JOIN_TO_READ),
      new NotFoundException(GROUP_NOT_FOUND),
    ],
  )
  findFeed(
    @Req() req: OptionalUser,
    @Query() query: CommunityThreadFeedQueryDto,
  ) {
    return this.threads.findFeed(req.user?.id ?? null, query);
  }

  @Get('community-threads/:id')
  @Public()
  @DefaultResponse(
    CommunityThreadDetailDto,
    'Get community thread success',
    HttpStatus.OK,
    [
      BadRequestException,
      new ForbiddenException(JOIN_TO_READ),
      new NotFoundException(THREAD_NOT_FOUND),
    ],
  )
  findOne(@Req() req: OptionalUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.findOne(req.user?.id ?? null, id);
  }

  @Post('community-threads')
  @DefaultResponse(
    CommunityThreadDetailDto,
    'Create community thread success',
    HttpStatus.CREATED,
    [
      new BadRequestException(EMPTY_THREAD),
      new ForbiddenException(JOIN_TO_POST),
      new NotFoundException(GROUP_NOT_FOUND),
    ],
  )
  create(@Req() req: SignedIn, @Body() input: CreateCommunityThreadDto) {
    return this.threads.create(req.user.id, input);
  }

  @Delete('community-threads/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    BadRequestException,
    new ForbiddenException(AUTHOR_OR_OWNER),
    new NotFoundException(THREAD_NOT_FOUND),
  ])
  removeThread(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.removeThread(req.user.id, id);
  }

  @Post('community-threads/:id/replies')
  @DefaultResponse(
    CommunityReplyResponseDto,
    'Create community reply success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      new ForbiddenException(JOIN_TO_POST),
      new NotFoundException(THREAD_NOT_FOUND),
    ],
  )
  reply(
    @Req() req: SignedIn,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateCommunityReplyDto,
  ) {
    return this.threads.reply(req.user.id, id, input);
  }

  @Put('community-threads/:id/like')
  @DefaultResponse(CommunityLikeResponseDto, 'Like success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(JOIN_TO_READ),
    new NotFoundException(THREAD_NOT_FOUND),
  ])
  likeThread(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.setThreadLike(req.user.id, id, true);
  }

  @Delete('community-threads/:id/like')
  @DefaultResponse(CommunityLikeResponseDto, 'Unlike success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(JOIN_TO_READ),
    new NotFoundException(THREAD_NOT_FOUND),
  ])
  unlikeThread(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.setThreadLike(req.user.id, id, false);
  }

  @Delete('community-replies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    BadRequestException,
    new ForbiddenException(AUTHOR_OR_OWNER),
    new NotFoundException(REPLY_NOT_FOUND),
  ])
  removeReply(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.removeReply(req.user.id, id);
  }

  @Put('community-replies/:id/like')
  @DefaultResponse(CommunityLikeResponseDto, 'Like success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(JOIN_TO_READ),
    new NotFoundException(REPLY_NOT_FOUND),
  ])
  likeReply(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.setReplyLike(req.user.id, id, true);
  }

  @Delete('community-replies/:id/like')
  @DefaultResponse(CommunityLikeResponseDto, 'Unlike success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(JOIN_TO_READ),
    new NotFoundException(REPLY_NOT_FOUND),
  ])
  unlikeReply(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.threads.setReplyLike(req.user.id, id, false);
  }
}
