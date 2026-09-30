import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { AuthTokenDto } from '../auth/dto/auth-token.dto';
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
import { MentorRegistrationDto } from './dto/mentor-registration.dto';
import { MentorRegisterDto, MentorSignUpDto } from './dto/mentor-sign-up.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { MentorService } from './mentor.service';
import { MentorWorkspaceService } from './mentor-workspace.service';

const mentorDocuments = FileFieldsInterceptor(
  [
    { name: 'cv', maxCount: 1 },
    { name: 'skill_certificate', maxCount: 1 },
  ],
  { limits: { fileSize: 5 * 1024 * 1024 } },
);

@Controller('mentors/v1')
@ApiTags('Mentors')
export class MentorController {
  constructor(
    private readonly mentorService: MentorService,
    private readonly mentorWorkspaceService: MentorWorkspaceService,
  ) {}

  @Post('sign-up')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(mentorDocuments)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MentorSignUpDto })
  @DefaultResponse(AuthTokenDto, 'Account Created!', HttpStatus.OK, [
    BadRequestException,
    ConflictException,
  ])
  signUp(
    @Body() input: MentorSignUpDto,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    return this.mentorService.signUp(input, files);
  }

  @Post('register')
  @ApiBearerAuth()
  @UseInterceptors(mentorDocuments)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MentorRegisterDto })
  @DefaultResponse(
    MentorResponseDto,
    'Register mentor success',
    HttpStatus.CREATED,
  )
  register(
    @Req() req: { user: { id: string } },
    @Body() input: MentorRegistrationDto,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    return this.mentorService.register(req.user.id, input, files);
  }

  @Get('get-mentor/:id')
  @Public()
  @DefaultResponse(PublicMentorResponseDto, 'Get mentor success')
  findPublicMentor(@Param('id', ParseUUIDPipe) id: string) {
    return this.mentorService.findPublicMentor(id);
  }

  @Get('get-profile')
  @ApiBearerAuth()
  @DefaultResponse(MentorResponseDto, 'Get mentor profile success')
  findProfile(@Req() req: { user: { id: string } }) {
    return this.mentorService.findProfile(req.user.id);
  }

  @Patch('update-profile')
  @ApiBearerAuth()
  @DefaultResponse(MentorResponseDto, 'Update mentor profile success')
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMentorDto,
  ) {
    return this.mentorService.updateMyMentor(req.user.id, input);
  }

  @Get('get-assignments')
  @ApiBearerAuth()
  @DefaultResponse(
    MentorAssignmentsResponseDto,
    'Get mentor assignments success',
  )
  findAssignments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findAssignments(req.user.id);
  }

  @Patch('update-documents')
  @ApiBearerAuth()
  @UseInterceptors(mentorDocuments)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cv: { type: 'string', format: 'binary' },
        skill_certificate: { type: 'string', format: 'binary' },
      },
    },
  })
  @ArrayResponse(MentorDocumentResponseDto, 'Update mentor documents success')
  updateDocuments(
    @Req() req: { user: { id: string } },
    @UploadedFiles() files: Record<string, Express.Multer.File[]>,
  ) {
    return this.mentorService.updateDocuments(req.user.id, files ?? {});
  }

  @Get('get-documents')
  @ApiBearerAuth()
  @ArrayResponse(MentorDocumentResponseDto, 'Get mentor documents success')
  findDocuments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findDocuments(req.user.id);
  }

  @Get('get-dashboard')
  @ApiBearerAuth()
  @DefaultResponse(MentorDashboardResponseDto, 'Get mentor dashboard success')
  findDashboard(@Req() req: { user: { id: string } }) {
    return this.mentorWorkspaceService.findDashboard(req.user.id);
  }

  @Get('get-classes')
  @ApiBearerAuth()
  @ArrayResponse(MentorClassResponseDto, 'Get mentor classes success')
  findClasses(
    @Req() req: { user: { id: string } },
    @Query() query: MentorClassesQueryDto,
  ) {
    return this.mentorWorkspaceService.findClasses(req.user.id, query);
  }

  @Get('get-teaching-classes')
  @ApiBearerAuth()
  @ArrayResponse(TeachingClassResponseDto, 'Get teaching classes success')
  findTeachingClasses(@Req() req: { user: { id: string } }) {
    return this.mentorWorkspaceService.findTeachingClasses(req.user.id);
  }
}
