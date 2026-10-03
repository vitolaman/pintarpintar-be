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
import {
  DefaultResponse,
  PaginatedObjectResponse,
} from '~/common/decorator/response.decorator';
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

const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const APPLICATION_NOT_FOUND = new NotFoundException('Application not found');

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
    [
      BadRequestException,
      new NotFoundException('Job posting not found'),
      new ConflictException('You have already applied to this job'),
    ],
  )
  apply(
    @Req() req: AuthenticatedRequest,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() input: ApplyJobDto,
  ) {
    return this.jobApplicationService.apply(req.user.id, jobId, input);
  }

  @Get('job-applications')
  @PaginatedObjectResponse(
    MyApplicationListResponseDto,
    'Get my applications success',
    [BadRequestException],
  )
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyApplicationQueryDto,
  ) {
    return this.jobApplicationService.findMine(req.user.id, query);
  }

  @Get('merchant/job-applications')
  @PaginatedObjectResponse(ApplicantListResponseDto, 'Get applicants success', [
    BadRequestException,
    MERCHANT_NOT_FOUND,
  ])
  findApplicants(
    @Req() req: AuthenticatedRequest,
    @Query() query: ApplicantQueryDto,
  ) {
    return this.jobApplicationService.findApplicants(req.user.id, query);
  }

  @Get('merchant/job-applications/:id/cv')
  @DefaultResponse(
    ApplicantCvLinkDto,
    'Get applicant CV success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND, APPLICATION_NOT_FOUND],
  )
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
    [BadRequestException, MERCHANT_NOT_FOUND, APPLICATION_NOT_FOUND],
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
    [
      BadRequestException,
      MERCHANT_NOT_FOUND,
      APPLICATION_NOT_FOUND,
      new ConflictException('The applicant account no longer exists'),
      new ConflictException('The applicant mentor account is not active'),
    ],
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
    [BadRequestException, MERCHANT_NOT_FOUND, APPLICATION_NOT_FOUND],
  )
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobApplicationService.reject(req.user.id, id);
  }
}
