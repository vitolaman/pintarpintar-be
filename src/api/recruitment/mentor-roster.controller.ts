import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  MentorRosterResponseDto,
  RosterMentorDetailDto,
} from './dto/mentor-roster.dto';
import { MentorRosterService } from './mentor-roster.service';

type AuthenticatedRequest = { user: { id: string } };

const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');

// The merchant's mentor list ("List Mentor" tab and the page summary cards).
@Controller('api/v1/merchant')
@ApiBearerAuth()
@ApiTags('Merchant Mentor Roster')
export class MentorRosterController {
  constructor(private readonly mentorRosterService: MentorRosterService) {}

  @Get('mentors')
  @DefaultResponse(
    MentorRosterResponseDto,
    'Get mentor roster success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND],
  )
  findRoster(@Req() req: AuthenticatedRequest) {
    return this.mentorRosterService.findRoster(req.user.id);
  }

  @Get('mentors/:userId')
  @DefaultResponse(
    RosterMentorDetailDto,
    'Get roster mentor success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND, new NotFoundException('Mentor not found')],
  )
  findRosterMentor(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) mentorUserId: string,
  ) {
    return this.mentorRosterService.findRosterMentor(req.user.id, mentorUserId);
  }
}
