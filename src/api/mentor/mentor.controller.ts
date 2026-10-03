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
    [BadRequestException, ConflictException, NotFoundException],
  )
  register(
    @Req() req: { user: { id: string } },
    @Body() input: MentorRegisterDto,
  ) {
    return this.mentorService.register(req.user.id, input);
  }

  @Get('mentors/:id')
  @Public()
  @DefaultResponse(PublicMentorResponseDto, 'Get mentor success')
  findPublicMentor(@Param('id', ParseUUIDPipe) id: string) {
    return this.mentorService.findPublicMentor(id);
  }

  @Get('mentor/profile')
  @ApiBearerAuth()
  @DefaultResponse(MentorResponseDto, 'Get mentor profile success')
  findProfile(@Req() req: { user: { id: string } }) {
    return this.mentorService.findProfile(req.user.id);
  }

  @Patch('mentor/profile')
  @ApiBearerAuth()
  @DefaultResponse(MentorResponseDto, 'Update mentor profile success')
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
  )
  findAssignments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findAssignments(req.user.id);
  }

  @Patch('mentor/documents')
  @ApiBearerAuth()
  @ArrayResponse(MentorDocumentResponseDto, 'Update mentor documents success', [
    BadRequestException,
    NotFoundException,
  ])
  updateDocuments(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMentorDocumentsDto,
  ) {
    return this.mentorService.updateDocuments(req.user.id, input);
  }

  @Get('mentor/documents')
  @ApiBearerAuth()
  @ArrayResponse(MentorDocumentResponseDto, 'Get mentor documents success')
  findDocuments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findDocuments(req.user.id);
  }

  @Get('mentor/dashboard')
  @ApiBearerAuth()
  @DefaultResponse(MentorDashboardResponseDto, 'Get mentor dashboard success')
  findDashboard(@Req() req: { user: { id: string } }) {
    return this.mentorWorkspaceService.findDashboard(req.user.id);
  }

  @Get('mentor/classes')
  @ApiBearerAuth()
  @ArrayResponse(MentorClassResponseDto, 'Get mentor classes success')
  findClasses(
    @Req() req: { user: { id: string } },
    @Query() query: MentorClassesQueryDto,
  ) {
    return this.mentorWorkspaceService.findClasses(req.user.id, query);
  }

  @Get('mentor/teaching-history')
  @ApiBearerAuth()
  @ArrayResponse(TeachingClassResponseDto, 'Get teaching classes success')
  findTeachingClasses(@Req() req: { user: { id: string } }) {
    return this.mentorWorkspaceService.findTeachingClasses(req.user.id);
  }
}
