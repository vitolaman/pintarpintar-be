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
import {
  ClientAddressThrottlerGuard,
  TOO_MANY_REQUESTS_MESSAGE,
} from '~/common/guard/client-address-throttler.guard';
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

// A learner who is not enrolled is told the class does not exist, so routes
// reached through an assignment, meeting or video answer either 404 message.
const CLASS_NOT_FOUND = new NotFoundException('Class not found');
const ASSIGNMENT_NOT_FOUND = [
  new NotFoundException('Assignment not found'),
  CLASS_NOT_FOUND,
];
const MEETING_NOT_FOUND = [
  new NotFoundException('Meeting not found'),
  CLASS_NOT_FOUND,
];
const PAST_DUE_RESUBMISSION = new ConflictException(
  'The due time has passed; the submission can no longer be changed',
);

// Routes for learners using what they bought. Apart from the public
// attendance page, every route requires an active enrollment (or product
// access) and answers 404 otherwise.
@Controller('api/v1')
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
  @Get('attendance/classes/:classId')
  @DefaultResponse(
    AttendanceSessionDto,
    'Get attendance session success',
    HttpStatus.OK,
    [CLASS_NOT_FOUND],
  )
  findAttendanceSession(@Param('classId', ParseUUIDPipe) classId: string) {
    return this.learningAttendance.findSession(classId);
  }

  // Check-in without login: the email must belong to an enrolled learner.
  @Public()
  @Post('attendance/classes/:classId/check-in')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @DefaultResponse(
    CheckInByEmailResponseDto,
    'Check in success',
    HttpStatus.OK,
    [
      BadRequestException,
      CLASS_NOT_FOUND,
      new NotFoundException('This email is not enrolled in this class'),
      new ThrottlerException(TOO_MANY_REQUESTS_MESSAGE),
    ],
  )
  checkInByEmail(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() input: CheckInByEmailDto,
  ) {
    return this.learningAttendance.checkInByEmail(classId, input);
  }

  @Post('learning/assignments/:assignmentId/submit')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    LearnerAssignmentDto,
    'Submit assignment success',
    HttpStatus.OK,
    [BadRequestException, ...ASSIGNMENT_NOT_FOUND, PAST_DUE_RESUBMISSION],
  )
  submitAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: SubmitAssignmentDto,
  ) {
    return this.learningSubmission.submitFile(req.user.id, assignmentId, input);
  }

  @Post('learning/assignments/:assignmentId/submit-quiz')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(LearnerAssignmentDto, 'Submit quiz success', HttpStatus.OK, [
    BadRequestException,
    ...ASSIGNMENT_NOT_FOUND,
    PAST_DUE_RESUBMISSION,
  ])
  submitQuiz(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: SubmitQuizDto,
  ) {
    return this.learningSubmission.submitQuiz(req.user.id, assignmentId, input);
  }

  @Get('learning/classes/:classId/assignments')
  @ArrayResponse(LearnerAssignmentDto, 'Get learning assignments success', [
    CLASS_NOT_FOUND,
  ])
  findAssignments(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.learningAssignment.findAssignments(req.user.id, classId);
  }

  @Get('learning/digital-products/:id')
  @DefaultResponse(
    OwnedProductDto,
    'Get owned digital product success',
    HttpStatus.OK,
    [new NotFoundException('Digital product not found')],
  )
  findProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learningProduct.findProduct(req.user.id, id);
  }

  @Get('learning/meetings/:meetingId')
  @DefaultResponse(LearnerMeetingDto, 'Get meeting success', HttpStatus.OK, [
    ...MEETING_NOT_FOUND,
  ])
  findMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.classAttendance.findMeetingForLearner(req.user.id, meetingId);
  }

  @Post('learning/meetings/:meetingId/check-in')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(LearnerMeetingDto, 'Check in success', HttpStatus.OK, [
    BadRequestException,
    ...MEETING_NOT_FOUND,
  ])
  checkIn(
    @Req() req: AuthenticatedRequest,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() input: CheckInDto,
  ) {
    return this.classAttendance.checkIn(req.user.id, meetingId, input.feedback);
  }

  @Get('learning/classes/:classId/grades')
  @DefaultResponse(
    LearnerGradesDto,
    'Get learning grades success',
    HttpStatus.OK,
    [CLASS_NOT_FOUND],
  )
  findGrades(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.learningAssignment.findGrades(req.user.id, classId);
  }

  @Get('learning/assignments/:assignmentId/quiz')
  @DefaultResponse(LearnerQuizDto, 'Get quiz success', HttpStatus.OK, [
    ...ASSIGNMENT_NOT_FOUND,
    new NotFoundException('Quiz not found'),
  ])
  findQuiz(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.learningAssignment.findQuiz(req.user.id, assignmentId);
  }

  @Get('learning/classes/:id')
  @DefaultResponse(
    LearningClassResponseDto,
    'Get learning class success',
    HttpStatus.OK,
    [CLASS_NOT_FOUND],
  )
  findClass(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.learningClass.findClass(req.user.id, id);
  }

  @Post('learning/videos/:videoId/complete')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    LearnerProgressResponseDto,
    'Complete video success',
    HttpStatus.OK,
    [new NotFoundException('Video not found'), CLASS_NOT_FOUND],
  )
  completeVideo(
    @Req() req: AuthenticatedRequest,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.learningProgress.completeVideo(req.user.id, videoId);
  }
}
