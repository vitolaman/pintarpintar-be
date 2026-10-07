import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
  EmptyResponse,
  PaginatedObjectResponse,
  PaginatedResponse,
} from '../common/decorator/response.decorator';
import { RequestPaginatedQueryDto } from '../common/dto/request-paginated.dto';
import { ChapterListQueryDto } from './dto/chapter-list-query.dto';
import { ClassService } from './class.service';
import { ClassContentService } from './class-content.service';
import { ClassAssignmentService } from './class-assignment.service';
import { ClassGradingService } from './class-grading.service';
import { ClassAttendanceService } from './class-attendance.service';
import { ClassCertificateService } from './class-certificate.service';
import {
  AttachCertificateFileDto,
  CertificateSettingsDto,
  CertificateViewDto,
  ClassCertificateLearnerDto,
  UpdateCertificateSettingsDto,
} from './dto/certificate.dto';
import {
  AttendanceRecapDto,
  AttendanceSummaryDto,
  SetAttendanceStatusDto,
} from './dto/attendance.dto';
import {
  GradeSubmissionDto,
  GradeTableDto,
  SubmissionViewDto,
} from './dto/grading.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CreateVideoDto, UpdateVideoDto } from './dto/video.dto';
import { AddResourcesDto, UpdateResourceDto } from './dto/resource.dto';
import { ReorderChapterItemsDto } from './dto/reorder-chapter-items.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateClassMentorDto } from './dto/update-class-mentor.dto';
import {
  ClassResponseDto,
  ChapterResponseDto,
  MeetingResponseDto,
  AssignmentResponseDto,
  ClassTutorResponseDto,
  StudentResponseDto,
  FileResourceResponseDto,
  VideoResponseDto,
} from './dto/class-response.dto';
import {
  CLASS_DELETE_CONFLICTS,
  CLASS_NOT_FOUND,
  OWNER_ONLY,
  notFound,
  tutorLacks,
} from './class-route-errors';

const CHAPTER_NOT_FOUND = notFound('Chapter not found');
const MEETING_NOT_FOUND = notFound('Meeting not found');
const LEARNER_NOT_FOUND = notFound('Learner not found');
const CERTIFICATE_NOT_FOUND = notFound('Certificate not found');
const ASSIGNMENT_NOT_FOUND = notFound('Assignment not found');
const CLASS_MENTOR_NOT_FOUND = notFound('Class mentor not found');

type AuthenticatedRequest = { user: { id: string } };

@ApiTags('Classes')
@ApiBearerAuth()
@Controller('api/v1/classes')
export class ClassController {
  constructor(
    private readonly classService: ClassService,
    private readonly classContentService: ClassContentService,
    private readonly classAssignmentService: ClassAssignmentService,
    private readonly classGradingService: ClassGradingService,
    private readonly classAttendanceService: ClassAttendanceService,
    private readonly classCertificateService: ClassCertificateService,
  ) {}

  @Get(':classId')
  @DefaultResponse(
    ClassResponseDto,
    'Get class detail success',
    HttpStatus.OK,
    [CLASS_NOT_FOUND],
  )
  getClassDetail(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classService.getClassById(req.user.id, classId);
  }

  @Patch(':classId')
  @DefaultResponse(ClassResponseDto, 'Update class success', HttpStatus.OK, [
    new ForbiddenException('Only the class owner can change: type, status'),
    new ForbiddenException(
      'Only the class owner or a lead tutor can edit the class',
    ),
    CLASS_NOT_FOUND,
  ])
  updateClass(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classService.updateClass(req.user.id, classId, dto);
  }

  @Delete(':classId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([OWNER_ONLY, CLASS_NOT_FOUND, ...CLASS_DELETE_CONFLICTS])
  deleteClass(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classService.deleteClass(req.user.id, classId);
  }

  @Post(':classId/chapters')
  @DefaultResponse(
    ChapterResponseDto,
    'Create chapter success',
    HttpStatus.CREATED,
    [tutorLacks('materi', 'tambah'), CLASS_NOT_FOUND],
  )
  createChapter(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.classContentService.createChapter(req.user.id, classId, dto);
  }

  @Get(':classId/chapters')
  @PaginatedResponse(ChapterResponseDto, 'Get class chapters success', [
    tutorLacks('materi', 'lihat'),
    CLASS_NOT_FOUND,
  ])
  getClassChapters(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: ChapterListQueryDto,
  ) {
    return this.classContentService.getChapters(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }

  @Patch(':classId/chapters/:chapterId')
  @DefaultResponse(
    ChapterResponseDto,
    'Update chapter success',
    HttpStatus.OK,
    [tutorLacks('materi', 'edit'), CLASS_NOT_FOUND, CHAPTER_NOT_FOUND],
  )
  updateChapter(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.classContentService.updateChapter(
      req.user.id,
      classId,
      chapterId,
      dto,
    );
  }

  @Delete(':classId/chapters/:chapterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('materi', 'delete'),
    CLASS_NOT_FOUND,
    CHAPTER_NOT_FOUND,
  ])
  deleteChapter(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
  ) {
    return this.classContentService.deleteChapter(
      req.user.id,
      classId,
      chapterId,
    );
  }

  @Put(':classId/chapters/order')
  @ArrayResponse(ChapterResponseDto, 'Reorder chapters success', [
    tutorLacks('materi', 'edit'),
    CLASS_NOT_FOUND,
  ])
  reorderChapters(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: ReorderChaptersDto,
  ) {
    return this.classContentService.reorderChapters(req.user.id, classId, dto);
  }

  @Put(':classId/chapters/:chapterId/order')
  @DefaultResponse(
    ChapterResponseDto,
    'Reorder chapter success',
    HttpStatus.OK,
    [tutorLacks('materi', 'edit'), CLASS_NOT_FOUND, CHAPTER_NOT_FOUND],
  )
  reorderChapterItems(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() dto: ReorderChapterItemsDto,
  ) {
    return this.classContentService.reorderChapterItems(
      req.user.id,
      classId,
      chapterId,
      dto,
    );
  }

  @Post(':classId/chapters/:chapterId/videos')
  @DefaultResponse(
    VideoResponseDto,
    'Create video success',
    HttpStatus.CREATED,
    [tutorLacks('materi', 'tambah'), CLASS_NOT_FOUND, CHAPTER_NOT_FOUND],
  )
  createVideo(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() dto: CreateVideoDto,
  ) {
    return this.classContentService.createVideo(
      req.user.id,
      classId,
      chapterId,
      dto,
    );
  }

  @Patch(':classId/chapters/:chapterId/videos/:videoId')
  @DefaultResponse(VideoResponseDto, 'Update video success', HttpStatus.OK, [
    tutorLacks('materi', 'edit'),
    CLASS_NOT_FOUND,
    CHAPTER_NOT_FOUND,
    notFound('Video not found'),
  ])
  updateVideo(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.classContentService.updateVideo(
      req.user.id,
      classId,
      chapterId,
      videoId,
      dto,
    );
  }

  @Delete(':classId/chapters/:chapterId/videos/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('materi', 'delete'),
    CLASS_NOT_FOUND,
    CHAPTER_NOT_FOUND,
    notFound('Video not found'),
  ])
  deleteVideo(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.classContentService.deleteVideo(
      req.user.id,
      classId,
      chapterId,
      videoId,
    );
  }

  @Post(':classId/chapters/:chapterId/resources')
  @ArrayResponse(
    FileResourceResponseDto,
    'Add resources success',
    [tutorLacks('materi', 'tambah'), CLASS_NOT_FOUND, CHAPTER_NOT_FOUND],
    HttpStatus.CREATED,
  )
  uploadResources(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() dto: AddResourcesDto,
  ) {
    return this.classContentService.addResources(
      req.user.id,
      classId,
      chapterId,
      dto,
    );
  }

  @Patch(':classId/chapters/:chapterId/resources/:resourceId')
  @DefaultResponse(
    FileResourceResponseDto,
    'Update resource success',
    HttpStatus.OK,
    [
      tutorLacks('materi', 'edit'),
      CLASS_NOT_FOUND,
      CHAPTER_NOT_FOUND,
      notFound('Resource not found'),
    ],
  )
  updateResource(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.classContentService.updateResource(
      req.user.id,
      classId,
      chapterId,
      resourceId,
      dto,
    );
  }

  @Delete(':classId/chapters/:chapterId/resources/:resourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('materi', 'delete'),
    CLASS_NOT_FOUND,
    CHAPTER_NOT_FOUND,
    notFound('Resource not found'),
  ])
  deleteResource(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.classContentService.deleteResource(
      req.user.id,
      classId,
      chapterId,
      resourceId,
    );
  }

  @Post(':classId/meetings')
  @DefaultResponse(
    MeetingResponseDto,
    'Create meeting success',
    HttpStatus.CREATED,
    [tutorLacks('meeting', 'tambah'), CLASS_NOT_FOUND],
  )
  createMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.classService.createMeeting(req.user.id, classId, dto);
  }

  @Patch(':classId/meetings/:meetingId')
  @DefaultResponse(
    MeetingResponseDto,
    'Update meeting success',
    HttpStatus.OK,
    [tutorLacks('meeting', 'edit'), CLASS_NOT_FOUND, MEETING_NOT_FOUND],
  )
  updateMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.classService.updateMeeting(
      req.user.id,
      classId,
      meetingId,
      dto,
    );
  }

  @Delete(':classId/meetings/:meetingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('meeting', 'delete'),
    CLASS_NOT_FOUND,
    MEETING_NOT_FOUND,
  ])
  deleteMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.classService.deleteMeeting(req.user.id, classId, meetingId);
  }

  @Get(':classId/certificate-settings')
  @DefaultResponse(
    CertificateSettingsDto,
    'Get certificate settings success',
    HttpStatus.OK,
    [tutorLacks('sertifikat', 'lihat'), CLASS_NOT_FOUND],
  )
  findCertificateSettings(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classCertificateService.findSettings(req.user.id, classId);
  }

  @Patch(':classId/certificate-settings')
  @DefaultResponse(
    CertificateSettingsDto,
    'Update certificate settings success',
    HttpStatus.OK,
    [tutorLacks('sertifikat', 'edit'), CLASS_NOT_FOUND],
  )
  updateCertificateSettings(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: UpdateCertificateSettingsDto,
  ) {
    return this.classCertificateService.updateSettings(
      req.user.id,
      classId,
      dto,
    );
  }

  @Get(':classId/certificates')
  @PaginatedResponse(
    ClassCertificateLearnerDto,
    'Get class certificates success',
    [tutorLacks('sertifikat', 'lihat'), CLASS_NOT_FOUND],
  )
  findCertificates(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classCertificateService.findCertificates(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }

  @Post(':classId/certificates/:userId/issue')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    CertificateViewDto,
    'Issue certificate success',
    HttpStatus.OK,
    [
      tutorLacks('sertifikat', 'tambah'),
      CLASS_NOT_FOUND,
      LEARNER_NOT_FOUND,
      new ConflictException('The certificate is already issued'),
    ],
  )
  issueCertificate(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('userId', ParseUUIDPipe) learnerId: string,
  ) {
    return this.classCertificateService.issueManually(
      req.user.id,
      classId,
      learnerId,
    );
  }

  @Put(':classId/certificates/:userId/file')
  @DefaultResponse(
    CertificateViewDto,
    'Attach certificate file success',
    HttpStatus.OK,
    [
      tutorLacks('sertifikat', 'edit'),
      CLASS_NOT_FOUND,
      LEARNER_NOT_FOUND,
      CERTIFICATE_NOT_FOUND,
    ],
  )
  attachCertificateFile(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('userId', ParseUUIDPipe) learnerId: string,
    @Body() dto: AttachCertificateFileDto,
  ) {
    return this.classCertificateService.attachFile(
      req.user.id,
      classId,
      learnerId,
      dto.asset_id,
    );
  }

  @Delete(':classId/certificates/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('sertifikat', 'delete'),
    CLASS_NOT_FOUND,
    LEARNER_NOT_FOUND,
    CERTIFICATE_NOT_FOUND,
  ])
  withdrawCertificate(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('userId', ParseUUIDPipe) learnerId: string,
  ) {
    return this.classCertificateService.withdraw(
      req.user.id,
      classId,
      learnerId,
    );
  }

  @Get(':classId/attendance-summary')
  @DefaultResponse(
    AttendanceSummaryDto,
    'Get attendance summary success',
    HttpStatus.OK,
    [tutorLacks('meeting', 'lihat'), CLASS_NOT_FOUND],
  )
  findAttendanceSummary(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classAttendanceService.findSummary(req.user.id, classId);
  }

  @Get(':classId/meetings/:meetingId/attendances')
  @DefaultResponse(
    AttendanceRecapDto,
    'Get attendance success',
    HttpStatus.OK,
    [tutorLacks('meeting', 'lihat'), CLASS_NOT_FOUND, MEETING_NOT_FOUND],
  )
  findAttendance(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.classAttendanceService.findRecap(
      req.user.id,
      classId,
      meetingId,
    );
  }

  @Patch(':classId/meetings/:meetingId/attendances/:userId')
  @DefaultResponse(
    AttendanceRecapDto,
    'Get attendance success',
    HttpStatus.OK,
    [
      tutorLacks('meeting', 'edit'),
      CLASS_NOT_FOUND,
      MEETING_NOT_FOUND,
      LEARNER_NOT_FOUND,
    ],
  )
  setAttendanceStatus(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('userId', ParseUUIDPipe) learnerId: string,
    @Body() dto: SetAttendanceStatusDto,
  ) {
    return this.classAttendanceService.setStatus(
      req.user.id,
      classId,
      meetingId,
      learnerId,
      dto.status,
    );
  }

  @Get(':classId/meetings')
  @PaginatedResponse(MeetingResponseDto, 'Get class meetings success', [
    tutorLacks('meeting', 'lihat'),
    CLASS_NOT_FOUND,
  ])
  getClassMeetings(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classService.getClassMeetings(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }

  @Post(':classId/assignments')
  @DefaultResponse(
    AssignmentResponseDto,
    'Create assignment success',
    HttpStatus.CREATED,
    [tutorLacks('tugas', 'tambah'), CLASS_NOT_FOUND],
  )
  createAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.classAssignmentService.createAssignment(
      req.user.id,
      classId,
      dto,
    );
  }

  @Get(':classId/assignments')
  @PaginatedResponse(AssignmentResponseDto, 'Get class assignments success', [
    CLASS_NOT_FOUND,
  ])
  getClassAssignments(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classAssignmentService.getAssignments(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }

  @Patch(':classId/assignments/:assignmentId')
  @DefaultResponse(
    AssignmentResponseDto,
    'Update assignment success',
    HttpStatus.OK,
    [
      tutorLacks('tugas', 'edit'),
      CLASS_NOT_FOUND,
      ASSIGNMENT_NOT_FOUND,
      new ConflictException(
        'The assignment type cannot change once learners have submitted',
      ),
      new ConflictException(
        'Quiz questions cannot change once learners have submitted',
      ),
    ],
  )
  updateAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.classAssignmentService.updateAssignment(
      req.user.id,
      classId,
      assignmentId,
      dto,
    );
  }

  @Delete(':classId/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('tugas', 'delete'),
    CLASS_NOT_FOUND,
    ASSIGNMENT_NOT_FOUND,
  ])
  deleteAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.classAssignmentService.deleteAssignment(
      req.user.id,
      classId,
      assignmentId,
    );
  }

  @Get(':classId/assignments/:assignmentId/submissions')
  @PaginatedResponse(SubmissionViewDto, 'Get submissions success', [
    tutorLacks('nilai', 'lihat'),
    CLASS_NOT_FOUND,
    ASSIGNMENT_NOT_FOUND,
  ])
  findSubmissions(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classGradingService.findSubmissions(
      req.user.id,
      classId,
      assignmentId,
      query.page,
      query.limit,
    );
  }

  @Patch(':classId/submissions/:submissionId/grade')
  @DefaultResponse(
    SubmissionViewDto,
    'Grade submission success',
    HttpStatus.OK,
    [
      tutorLacks('nilai', 'edit'),
      CLASS_NOT_FOUND,
      notFound('Submission not found'),
    ],
  )
  gradeSubmission(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.classGradingService.gradeSubmission(
      req.user.id,
      classId,
      submissionId,
      dto,
    );
  }

  @Get(':classId/grades')
  @PaginatedObjectResponse(GradeTableDto, 'Get class grades success', [
    tutorLacks('nilai', 'lihat'),
    CLASS_NOT_FOUND,
  ])
  findGrades(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classGradingService.findGradeTable(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }

  @Post(':classId/mentors')
  @DefaultResponse(
    ClassTutorResponseDto,
    'Invite mentor success',
    HttpStatus.CREATED,
    [
      CLASS_NOT_FOUND,
      notFound('No active mentor account uses this email'),
      new ConflictException('Mentor is already assigned to this class'),
    ],
  )
  inviteMentor(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: InviteMentorDto,
  ) {
    return this.classService.inviteMentor(req.user.id, classId, dto);
  }

  @Patch(':classId/mentors/:classMentorId')
  @DefaultResponse(
    ClassTutorResponseDto,
    'Update class mentor success',
    HttpStatus.OK,
    [OWNER_ONLY, CLASS_NOT_FOUND, CLASS_MENTOR_NOT_FOUND],
  )
  updateClassMentor(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classMentorId', ParseUUIDPipe) classMentorId: string,
    @Body() dto: UpdateClassMentorDto,
  ) {
    return this.classService.updateClassMentor(
      req.user.id,
      classId,
      classMentorId,
      dto,
    );
  }

  @Delete(':classId/mentors/:classMentorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([OWNER_ONLY, CLASS_NOT_FOUND, CLASS_MENTOR_NOT_FOUND])
  revokeClassMentor(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('classMentorId', ParseUUIDPipe) classMentorId: string,
  ) {
    return this.classService.revokeClassMentor(
      req.user.id,
      classId,
      classMentorId,
    );
  }

  @Get(':classId/mentors')
  @PaginatedResponse(ClassTutorResponseDto, 'Get class mentors success', [
    CLASS_NOT_FOUND,
  ])
  getClassMentors(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classService.getClassMentors(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }

  @Get(':classId/students')
  @PaginatedResponse(StudentResponseDto, 'Get class students success', [
    CLASS_NOT_FOUND,
  ])
  getClassStudents(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.classService.getClassStudents(
      req.user.id,
      classId,
      query.page,
      query.limit,
    );
  }
}
