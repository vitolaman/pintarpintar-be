import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  MentorRosterResponseDto,
  RosterMentorDetailDto,
} from './dto/mentor-roster.dto';
import { MentorRosterService } from './mentor-roster.service';

type AuthenticatedRequest = { user: { id: string } };

// The merchant's mentor list ("List Mentor" tab and the page summary cards).
@Controller('api/v1/merchant')
@ApiBearerAuth()
@ApiTags('Merchant Mentor Roster')
export class MentorRosterController {
  constructor(private readonly mentorRosterService: MentorRosterService) {}

  @Get('mentors')
  @DefaultResponse(MentorRosterResponseDto, 'Get mentor roster success')
  findRoster(@Req() req: AuthenticatedRequest) {
    return this.mentorRosterService.findRoster(req.user.id);
  }

  @Get('mentors/:userId')
  @DefaultResponse(RosterMentorDetailDto, 'Get roster mentor success')
  findRosterMentor(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) mentorUserId: string,
  ) {
    return this.mentorRosterService.findRosterMentor(req.user.id, mentorUserId);
  }
}
