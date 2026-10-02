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

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Karir Job Applications')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationService) {}

  @Post('job-postings/:jobId/apply')
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

  @Get('job-applications')
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

  @Get('merchant/job-applications')
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

  @Get('merchant/job-applications/:id/cv')
  @DefaultResponse(ApplicantCvLinkDto, 'Get applicant CV success')
  findApplicantCv(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobApplicationService.findApplicantCv(req.user.id, id);
  }

  @Post('merchant/job-applications/:id/schedule-interview')
  @HttpCode(HttpStatus.OK)
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

  @Post('merchant/job-applications/:id/accept')
  @HttpCode(HttpStatus.OK)
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

  @Post('merchant/job-applications/:id/reject')
  @HttpCode(HttpStatus.OK)
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
