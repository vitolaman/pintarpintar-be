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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerException } from '@nestjs/throttler';
import { Public } from '~/common/decorator/public.decorator';
import { ClientAddressThrottlerGuard } from '~/common/guard/client-address-throttler.guard';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { LearningProgressService } from '../../class/learning-progress.service';
import { ClassAttendanceService } from '../../class/class-attendance.service';
import { CheckInDto, LearnerMeetingDto } from '../../class/dto/attendance.dto';
import {
  LearnerProgressResponseDto,
  LearningClassResponseDto,
} from './dto/learning-response.dto';
import { LearningClassService } from './learning-class.service';
import { LearningAssignmentService } from './learning-assignment.service';
import {
  LearnerAssignmentDto,
  LearnerGradesDto,
  LearnerQuizDto,
  SubmitAssignmentDto,
  SubmitQuizDto,
} from './dto/learning-assignment.dto';
import { LearningSubmissionService } from './learning-submission.service';
import { LearningProductService } from './learning-product.service';
import { LearningAttendanceService } from './learning-attendance.service';
import {
  AttendanceSessionDto,
  CheckInByEmailDto,
  CheckInByEmailResponseDto,
} from './dto/public-attendance.dto';
import { OwnedProductDto } from './dto/learning-product.dto';

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
    private readonly classAttendance: ClassAttendanceService,
    private readonly learningProduct: LearningProductService,
    private readonly learningAttendance: LearningAttendanceService,
  ) {}

  // Public attendance page (/absensi/{classId}); never exposes meeting links.
  @Public()
  @Get('get-attendance-session/:classId')
  @DefaultResponse(AttendanceSessionDto, 'Get attendance session success')
  findAttendanceSession(@Param('classId', ParseUUIDPipe) classId: string) {
    return this.learningAttendance.findSession(classId);
  }

  // Check-in without login: the email must belong to an enrolled learner.
  @Public()
  @Post('check-in-by-email/:classId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @DefaultResponse(
    CheckInByEmailResponseDto,
    'Check in success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException, ThrottlerException],
  )
  checkInByEmail(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() input: CheckInByEmailDto,
  ) {
    return this.learningAttendance.checkInByEmail(classId, input);
  }

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

  @Get('get-digital-product/:id')
  @DefaultResponse(
    OwnedProductDto,
    'Get owned digital product success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learningProduct.findProduct(req.user.id, id);
  }

  @Get('get-meeting/:meetingId')
  @DefaultResponse(LearnerMeetingDto, 'Get meeting success', HttpStatus.OK, [
    NotFoundException,
  ])
  findMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.classAttendance.findMeetingForLearner(req.user.id, meetingId);
  }

  @Post('check-in/:meetingId')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(LearnerMeetingDto, 'Check in success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  checkIn(
    @Req() req: AuthenticatedRequest,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() input: CheckInDto,
  ) {
    return this.classAttendance.checkIn(req.user.id, meetingId, input.review);
  }

  @Get('get-grades/:classId')
  @DefaultResponse(
    LearnerGradesDto,
    'Get learning grades success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findGrades(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.learningAssignment.findGrades(req.user.id, classId);
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
