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
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  ArrayResponse,
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { GROUP_NOT_FOUND } from './community-access';
import {
  CommunityGroupService,
  OWNER_CANNOT_LEAVE,
  OWNER_ONLY,
  REQUEST_NOT_FOUND,
} from './community-group.service';
import {
  CommunityGroupListQueryDto,
  CommunityGroupResponseDto,
  CommunityJoinRequestDto,
  CommunityMembershipDto,
  CreateCommunityGroupDto,
} from './dto/community-group.dto';

type OptionalUser = { user?: { id: string } };
type SignedIn = { user: { id: string } };

@Controller('api/v1/community-groups')
@ApiBearerAuth()
@ApiTags('Community')
export class CommunityGroupController {
  constructor(private readonly groups: CommunityGroupService) {}

  @Post()
  @DefaultResponse(
    CommunityGroupResponseDto,
    'Create community group success',
    HttpStatus.CREATED,
    [BadRequestException],
  )
  create(@Req() req: SignedIn, @Body() input: CreateCommunityGroupDto) {
    return this.groups.create(req.user.id, input);
  }

  // Public; a token adds the caller's membership and enables `joined`.
  @Get()
  @Public()
  @PaginatedResponse(
    CommunityGroupResponseDto,
    'Get community groups success',
    [BadRequestException],
  )
  findAll(
    @Req() req: OptionalUser,
    @Query() query: CommunityGroupListQueryDto,
  ) {
    return this.groups.findAll(req.user?.id ?? null, query);
  }

  @Get(':id')
  @Public()
  @DefaultResponse(
    CommunityGroupResponseDto,
    'Get community group success',
    HttpStatus.OK,
    [BadRequestException, new NotFoundException(GROUP_NOT_FOUND)],
  )
  findOne(@Req() req: OptionalUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.findOne(req.user?.id ?? null, id);
  }

  // A public group admits at once; a request-only group records a request.
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    CommunityMembershipDto,
    'Join community group success',
    HttpStatus.OK,
    [BadRequestException, new NotFoundException(GROUP_NOT_FOUND)],
  )
  join(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.join(req.user.id, id);
  }

  // Leaves the group or cancels a pending request.
  @Delete(':id/membership')
  @DefaultResponse(
    CommunityMembershipDto,
    'Leave community group success',
    HttpStatus.OK,
    [
      new BadRequestException(OWNER_CANNOT_LEAVE),
      new NotFoundException(GROUP_NOT_FOUND),
    ],
  )
  leave(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.leave(req.user.id, id);
  }

  @Get(':id/requests')
  @ArrayResponse(CommunityJoinRequestDto, 'Get join requests success', [
    BadRequestException,
    new ForbiddenException(OWNER_ONLY),
    new NotFoundException(GROUP_NOT_FOUND),
  ])
  findRequests(@Req() req: SignedIn, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.findRequests(req.user.id, id);
  }

  @Post(':id/requests/:userId/accept')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    CommunityMembershipDto,
    "Accept join request success; the requester's membership",
    HttpStatus.OK,
    [
      BadRequestException,
      new ForbiddenException(OWNER_ONLY),
      new NotFoundException(REQUEST_NOT_FOUND),
    ],
  )
  accept(
    @Req() req: SignedIn,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.groups.decideRequest(req.user.id, id, userId, 'accept');
  }

  @Post(':id/requests/:userId/reject')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    CommunityMembershipDto,
    "Reject join request success; the requester's membership",
    HttpStatus.OK,
    [
      BadRequestException,
      new ForbiddenException(OWNER_ONLY),
      new NotFoundException(REQUEST_NOT_FOUND),
    ],
  )
  reject(
    @Req() req: SignedIn,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.groups.decideRequest(req.user.id, id, userId, 'reject');
  }
}
