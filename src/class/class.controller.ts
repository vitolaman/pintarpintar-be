import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DefaultResponse, PaginatedResponse } from '../common/decorator/response.decorator';
import { ClassService } from './class.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';
import { 
  ClassResponseDto, 
  ChapterResponseDto, 
  MeetingResponseDto, 
  AssignmentResponseDto, 
  MentorResponseDto, 
  StudentResponseDto 
} from './dto/class-response.dto';

@ApiTags('Classes')
@ApiBearerAuth()
@Controller('api/v1/classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Get(':classId')
  @DefaultResponse(ClassResponseDto, 'Get class detail success')
  getClassDetail(@Param('classId') classId: string) {
    return this.classService.getClassById(classId);
  }

  @Post(':classId/chapters')
  createChapter(@Param('classId') classId: string, @Body() dto: CreateChapterDto) {
    return this.classService.createChapter(classId, dto);
  }

  @Get(':classId/chapters')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(ChapterResponseDto, 'Get class chapters success')
  getClassChapters(
    @Param('classId') classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassChapters(classId, page || 1, limit || 10);
  }

  @Post(':classId/chapters/:chapterId/resources')
  uploadResources(
    @Param('classId') classId: string,
    @Param('chapterId') chapterId: string,
    @Body('resources') resources: { type: string; name: string; url: string }[],
  ) {
    return this.classService.addResources(chapterId, resources || []);
  }

  @Post(':classId/meetings')
  createMeeting(@Param('classId') classId: string, @Body() dto: CreateMeetingDto) {
    return this.classService.createMeeting(classId, dto);
  }

  @Get(':classId/meetings')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(MeetingResponseDto, 'Get class meetings success')
  getClassMeetings(
    @Param('classId') classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassMeetings(classId, page || 1, limit || 10);
  }

  @Post(':classId/assignments')
  createAssignment(@Param('classId') classId: string, @Body() dto: CreateAssignmentDto) {
    return this.classService.createAssignment(classId, dto);
  }

  @Get(':classId/assignments')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(AssignmentResponseDto, 'Get class assignments success')
  getClassAssignments(
    @Param('classId') classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassAssignments(classId, page || 1, limit || 10);
  }

  @Post(':classId/mentors')
  inviteMentor(@Param('classId') classId: string, @Body() dto: InviteMentorDto) {
    return this.classService.inviteMentor(classId, dto);
  }

  @Get(':classId/mentors')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(MentorResponseDto, 'Get class mentors success')
  getClassMentors(
    @Param('classId') classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassMentors(classId, page || 1, limit || 10);
  }

  @Get(':classId/students')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @PaginatedResponse(StudentResponseDto, 'Get class students success')
  getClassStudents(
    @Param('classId') classId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.classService.getClassStudents(classId, page || 1, limit || 10);
  }
}
