import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import {
  MentorAssignmentsResponseDto,
  MentorDocumentResponseDto,
  MentorResponseDto,
  PublicMentorResponseDto,
} from './dto/mentor-response.dto';
import {
  MentorClassesQueryDto,
  MentorClassResponseDto,
  MentorDashboardResponseDto,
  TeachingClassResponseDto,
} from './dto/mentor-workspace.dto';
import {
  MentorRegisterDto,
  UpdateMentorDocumentsDto,
} from './dto/mentor-documents.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { MentorService } from './mentor.service';
import { MentorWorkspaceService } from './mentor-workspace.service';

const MENTOR_NOT_FOUND = new NotFoundException('Mentor not found');
const MENTOR_PROFILE_NOT_FOUND = new NotFoundException(
  'Mentor profile not found',
);

@Controller('api/v1')
@ApiTags('Mentors')
export class MentorController {
  constructor(
    private readonly mentorService: MentorService,
    private readonly mentorWorkspaceService: MentorWorkspaceService,
  ) {}

  // A mentor signs up as a regular user first, uploads the CV and the skill
  // certificate, then registers with their asset ids.
  @Post('mentor/register')
  @ApiBearerAuth()
  @DefaultResponse(
    MentorResponseDto,
    'Register mentor success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      new ConflictException('User is already a mentor'),
      new NotFoundException('User not found'),
    ],
  )
  register(
    @Req() req: { user: { id: string } },
    @Body() input: MentorRegisterDto,
  ) {
    return this.mentorService.register(req.user.id, input);
  }

  @Get('mentors/:id')
  @Public()
  @DefaultResponse(
    PublicMentorResponseDto,
    'Get mentor success',
    HttpStatus.OK,
    [MENTOR_NOT_FOUND],
  )
  findPublicMentor(@Param('id', ParseUUIDPipe) id: string) {
    return this.mentorService.findPublicMentor(id);
  }

  @Get('mentor/profile')
  @ApiBearerAuth()
  @DefaultResponse(
    MentorResponseDto,
    'Get mentor profile success',
    HttpStatus.OK,
    [MENTOR_NOT_FOUND],
  )
  findProfile(@Req() req: { user: { id: string } }) {
    return this.mentorService.findProfile(req.user.id);
  }

  @Patch('mentor/profile')
  @ApiBearerAuth()
  @DefaultResponse(
    MentorResponseDto,
    'Update mentor profile success',
    HttpStatus.OK,
    [BadRequestException, MENTOR_NOT_FOUND, MENTOR_PROFILE_NOT_FOUND],
  )
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMentorDto,
  ) {
    return this.mentorService.updateMyMentor(req.user.id, input);
  }

  @Get('mentor/assignments')
  @ApiBearerAuth()
  @DefaultResponse(
    MentorAssignmentsResponseDto,
    'Get mentor assignments success',
    HttpStatus.OK,
    [MENTOR_NOT_FOUND],
  )
  findAssignments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findAssignments(req.user.id);
  }

  @Patch('mentor/documents')
  @ApiBearerAuth()
  @ArrayResponse(MentorDocumentResponseDto, 'Update mentor documents success', [
    BadRequestException,
    MENTOR_NOT_FOUND,
    MENTOR_PROFILE_NOT_FOUND,
  ])
  updateDocuments(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMentorDocumentsDto,
  ) {
    return this.mentorService.updateDocuments(req.user.id, input);
  }

  @Get('mentor/documents')
  @ApiBearerAuth()
  @ArrayResponse(MentorDocumentResponseDto, 'Get mentor documents success', [
    MENTOR_NOT_FOUND,
  ])
  findDocuments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findDocuments(req.user.id);
  }

  @Get('mentor/dashboard')
  @ApiBearerAuth()
  @DefaultResponse(
    MentorDashboardResponseDto,
    'Get mentor dashboard success',
    HttpStatus.OK,
    [MENTOR_NOT_FOUND],
  )
  findDashboard(@Req() req: { user: { id: string } }) {
    return this.mentorWorkspaceService.findDashboard(req.user.id);
  }

  @Get('mentor/classes')
  @ApiBearerAuth()
  @ArrayResponse(MentorClassResponseDto, 'Get mentor classes success', [
    MENTOR_NOT_FOUND,
  ])
  findClasses(
    @Req() req: { user: { id: string } },
    @Query() query: MentorClassesQueryDto,
  ) {
    return this.mentorWorkspaceService.findClasses(req.user.id, query);
  }

  @Get('mentor/teaching-history')
  @ApiBearerAuth()
  @ArrayResponse(TeachingClassResponseDto, 'Get teaching classes success', [
    MENTOR_NOT_FOUND,
  ])
  findTeachingClasses(@Req() req: { user: { id: string } }) {
    return this.mentorWorkspaceService.findTeachingClasses(req.user.id);
  }
}
