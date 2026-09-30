import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DefaultResponse, PaginatedResponse } from '../common/decorator/response.decorator';
import { ClassService } from './class.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { 
  ClassResponseDto, 
  ChapterResponseDto, 
  MeetingResponseDto, 
  AssignmentResponseDto, 
  MentorResponseDto, 
  StudentResponseDto 
} from './dto/class-response.dto';

type AuthenticatedRequest = { user: { id: string } };

@ApiTags('Classes')
@ApiBearerAuth()
@Controller('api/v1/classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

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
  createChapter(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.classService.createChapter(req.user.id, classId, dto);
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
    return this.classService.getClassChapters(
      req.user.id,
      classId,
      page || 1,
      limit || 10,
    );
  }

  @Post(':classId/chapters/:chapterId/resources')
  uploadResources(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body('resources') resources: { type: string; name: string; url: string }[],
  ) {
    return this.classService.addResources(
      req.user.id,
      classId,
      chapterId,
      resources || [],
    );
  }

  @Post(':classId/meetings')
  createMeeting(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.classService.createMeeting(req.user.id, classId, dto);
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
  createAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.classService.createAssignment(req.user.id, classId, dto);
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
    return this.classService.getClassAssignments(
      req.user.id,
      classId,
      page || 1,
      limit || 10,
    );
  }

  @Post(':classId/mentors')
  inviteMentor(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: InviteMentorDto,
  ) {
    return this.classService.inviteMentor(req.user.id, classId, dto);
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
