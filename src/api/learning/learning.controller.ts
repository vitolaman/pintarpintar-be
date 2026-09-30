import {
  BadRequestException,
  Body,
  ConflictException,
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
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { LearningProgressService } from '../../class/learning-progress.service';
import {
  LearnerProgressResponseDto,
  LearningClassResponseDto,
} from './dto/learning-response.dto';
import { LearningClassService } from './learning-class.service';
import { LearningAssignmentService } from './learning-assignment.service';
import {
  LearnerAssignmentDto,
  LearnerQuizDto,
  SubmitAssignmentDto,
  SubmitQuizDto,
} from './dto/learning-assignment.dto';
import { LearningSubmissionService } from './learning-submission.service';

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
    private readonly learningAssignment: LearningAssignmentService,
    private readonly learningSubmission: LearningSubmissionService,
  ) {}

  @Post('submit-assignment/:assignmentId')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    LearnerAssignmentDto,
    'Submit assignment success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException, ConflictException],
  )
  submitAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: SubmitAssignmentDto,
  ) {
    return this.learningSubmission.submitFile(req.user.id, assignmentId, input);
  }

  @Post('submit-quiz/:assignmentId')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(LearnerAssignmentDto, 'Submit quiz success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
    ConflictException,
  ])
  submitQuiz(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: SubmitQuizDto,
  ) {
    return this.learningSubmission.submitQuiz(req.user.id, assignmentId, input);
  }

  @Get('get-assignments/:classId')
  @ArrayResponse(LearnerAssignmentDto, 'Get learning assignments success', [
    NotFoundException,
  ])
  findAssignments(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.learningAssignment.findAssignments(req.user.id, classId);
  }

  @Get('get-quiz/:assignmentId')
  @DefaultResponse(LearnerQuizDto, 'Get quiz success', HttpStatus.OK, [
    NotFoundException,
  ])
  findQuiz(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.learningAssignment.findQuiz(req.user.id, assignmentId);
  }

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
