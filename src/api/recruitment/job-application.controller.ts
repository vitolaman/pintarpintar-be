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
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  ApplicantCvLinkDto,
  ApplicantListResponseDto,
  ApplicantQueryDto,
  ApplicantResponseDto,
  ApplyJobDto,
  MyApplicationListResponseDto,
  MyApplicationQueryDto,
  MyApplicationResponseDto,
  ScheduleInterviewDto,
} from './dto/job-application.dto';
import { JobApplicationService } from './job-application.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('job-applications/v1')
@ApiBearerAuth()
@ApiTags('Karir Job Applications')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationService) {}

  @Post('apply/:jobId')
  @DefaultResponse(
    MyApplicationResponseDto,
    'Apply job success',
    HttpStatus.CREATED,
    [BadRequestException, NotFoundException, ConflictException],
  )
  apply(
    @Req() req: AuthenticatedRequest,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() input: ApplyJobDto,
  ) {
    return this.jobApplicationService.apply(req.user.id, jobId, input);
  }

  @Get('get-my-applications')
  @DefaultResponse(
    MyApplicationListResponseDto,
    'Get my applications success',
    HttpStatus.OK,
    [BadRequestException],
  )
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyApplicationQueryDto,
  ) {
    return this.jobApplicationService.findMine(req.user.id, query);
  }

  @Get('get-applicants')
  @DefaultResponse(
    ApplicantListResponseDto,
    'Get applicants success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findApplicants(
    @Req() req: AuthenticatedRequest,
    @Query() query: ApplicantQueryDto,
  ) {
    return this.jobApplicationService.findApplicants(req.user.id, query);
  }

  @Get('get-applicant-cv/:id')
  @DefaultResponse(ApplicantCvLinkDto, 'Get applicant CV success')
  findApplicantCv(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobApplicationService.findApplicantCv(req.user.id, id);
  }

  @Patch('schedule-interview/:id')
  @DefaultResponse(
    ApplicantResponseDto,
    'Schedule interview success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  scheduleInterview(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ScheduleInterviewDto,
  ) {
    return this.jobApplicationService.scheduleInterview(req.user.id, id, input);
  }

  @Patch('accept-applicant/:id')
  @DefaultResponse(
    ApplicantResponseDto,
    'Accept applicant success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException, ConflictException],
  )
  accept(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobApplicationService.accept(req.user.id, id);
  }

  @Patch('reject-applicant/:id')
  @DefaultResponse(
    ApplicantResponseDto,
    'Reject applicant success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobApplicationService.reject(req.user.id, id);
  }
}
