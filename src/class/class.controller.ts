import {
  Body,
  Controller,
  Delete,
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
import { ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  DefaultResponse,
  EmptyResponse,
  PaginatedResponse,
} from '../common/decorator/response.decorator';
import { ClassService } from './class.service';
import { ClassContentService } from './class-content.service';
import { ClassAssignmentService } from './class-assignment.service';
import { ClassGradingService } from './class-grading.service';
import { ClassAttendanceService } from './class-attendance.service';
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
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CreateVideoDto, UpdateVideoDto } from './dto/video.dto';
import { AddResourcesDto, UpdateResourceDto } from './dto/resource.dto';
import { ReorderChapterItemsDto } from './dto/reorder-chapter-items.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateClassMentorDto } from './dto/update-class-mentor.dto';
import { 
  ClassResponseDto, 
  ChapterResponseDto, 
  MeetingResponseDto, 
  AssignmentResponseDto, 
  MentorResponseDto, 
  StudentResponseDto,
  FileResourceResponseDto,
  VideoResponseDto,
} from './dto/class-response.dto';

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
  ) {}

  @Get(':classId')
  @DefaultResponse(ClassResponseDto, 'Get class detail success')
  getClassDetail(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classService.getClassById(req.user.id, classId);
  }

  @Patch(':classId')
  @DefaultResponse(ClassResponseDto, 'Update class success')
  updateClass(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classService.updateClass(req.user.id, classId, dto);
  }

  @Post(':classId/chapters')
  @DefaultResponse(
    ChapterResponseDto,
    'Create chapter success',
    HttpStatus.CREATED,
  )
  createChapter(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.classContentService.createChapter(req.user.id, classId, dto);
  }

  @Get(':classId/chapters')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(ChapterResponseDto, 'Get class chapters success')
  getClassChapters(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classContentService.getChapters(
      req.user.id,
      classId,
      Math.max(Number(page) || 1, 1),
      Math.min(Math.max(Number(limit) || 10, 1), 100),
    );
  }

  @Patch(':classId/chapters/:chapterId')
  @DefaultResponse(ChapterResponseDto, 'Update chapter success')
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
  @EmptyResponse()
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

  @Put(':classId/chapters/:chapterId/order')
  @DefaultResponse(ChapterResponseDto, 'Reorder chapter success')
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
  @DefaultResponse(VideoResponseDto, 'Create video success', HttpStatus.CREATED)
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
  @DefaultResponse(VideoResponseDto, 'Update video success')
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
  @EmptyResponse()
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
  @DefaultResponse(
    FileResourceResponseDto,
    'Add resources success',
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
  @DefaultResponse(FileResourceResponseDto, 'Update resource success')
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
  @EmptyResponse()
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
  )
  createMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.classService.createMeeting(req.user.id, classId, dto);
  }

  @Patch(':classId/meetings/:meetingId')
  @DefaultResponse(MeetingResponseDto, 'Update meeting success')
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

  @Get(':classId/attendance-summary')
  @DefaultResponse(AttendanceSummaryDto, 'Get attendance summary success')
  findAttendanceSummary(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classAttendanceService.findSummary(req.user.id, classId);
  }

  @Get(':classId/meetings/:meetingId/attendances')
  @DefaultResponse(AttendanceRecapDto, 'Get attendance success')
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
  @DefaultResponse(AttendanceRecapDto, 'Get attendance success')
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(MeetingResponseDto, 'Get class meetings success')
  getClassMeetings(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassMeetings(
      req.user.id,
      classId,
      page || 1,
      limit || 10,
    );
  }

  @Post(':classId/assignments')
  @DefaultResponse(
    AssignmentResponseDto,
    'Create assignment success',
    HttpStatus.CREATED,
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(AssignmentResponseDto, 'Get class assignments success')
  getClassAssignments(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classAssignmentService.getAssignments(
      req.user.id,
      classId,
      Math.max(Number(page) || 1, 1),
      Math.min(Math.max(Number(limit) || 10, 1), 100),
    );
  }

  @Delete(':classId/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse()
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(SubmissionViewDto, 'Get submissions success')
  findSubmissions(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classGradingService.findSubmissions(
      req.user.id,
      classId,
      assignmentId,
      Math.max(Number(page) || 1, 1),
      Math.min(Math.max(Number(limit) || 20, 1), 100),
    );
  }

  @Patch(':classId/submissions/:submissionId/grade')
  @DefaultResponse(SubmissionViewDto, 'Grade submission success')
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @DefaultResponse(GradeTableDto, 'Get class grades success')
  findGrades(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classGradingService.findGradeTable(
      req.user.id,
      classId,
      Math.max(Number(page) || 1, 1),
      Math.min(Math.max(Number(limit) || 50, 1), 100),
    );
  }

  @Post(':classId/mentors')
  @DefaultResponse(
    MentorResponseDto,
    'Invite mentor success',
    HttpStatus.CREATED,
  )
  inviteMentor(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: InviteMentorDto,
  ) {
    return this.classService.inviteMentor(req.user.id, classId, dto);
  }

  @Patch(':classId/mentors/:classMentorId')
  @DefaultResponse(MentorResponseDto, 'Update class mentor success')
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
  @EmptyResponse()
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(MentorResponseDto, 'Get class mentors success')
  getClassMentors(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassMentors(
      req.user.id,
      classId,
      page || 1,
      limit || 10,
    );
  }

  @Get(':classId/students')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(StudentResponseDto, 'Get class students success')
  getClassStudents(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassStudents(
      req.user.id,
      classId,
      page || 1,
      limit || 10,
    );
  }
}
