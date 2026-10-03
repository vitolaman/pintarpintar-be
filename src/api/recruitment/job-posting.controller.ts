import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  DefaultResponse,
  PaginatedResponse,
  PaginatedObjectResponse,
} from '~/common/decorator/response.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import {
  CreateJobPostingDto,
  JobBoardResponseDto,
  JobPostingResponseDto,
  PublicJobQueryDto,
  SavedJobPostingResponseDto,
  SaveJobPostingResponseDto,
  UpdateJobPostingDto,
} from './dto/job-posting.dto';
import { JobPostingService } from './job-posting.service';

type AuthenticatedRequest = { user: { id: string } };

const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const MERCHANT_NOT_ACTIVE = new ForbiddenException('Merchant is not active');
const JOB_NOT_FOUND = new NotFoundException('Job posting not found');

// Public routes: a valid token identifies the caller, and no token is fine.
type OptionalAuthRequest = { user?: { id: string } };

@Controller('api/v1')
@ApiTags('Karir Job Postings')
export class JobPostingController {
  constructor(private readonly jobPostingService: JobPostingService) {}

  @Get('job-postings')
  @Public()
  @PaginatedObjectResponse(JobBoardResponseDto, 'Get job board success', [
    BadRequestException,
  ])
  findPublic(
    @Req() req: OptionalAuthRequest,
    @Query() query: PublicJobQueryDto,
  ) {
    return this.jobPostingService.findPublic(query, req.user?.id);
  }

  // Declared before job-postings/:id so "saved" is not read as an id.
  @Get('job-postings/saved')
  @ApiBearerAuth()
  @PaginatedResponse(
    SavedJobPostingResponseDto,
    'Get saved job postings success',
  )
  findSaved(
    @Req() req: AuthenticatedRequest,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.jobPostingService.findSaved(req.user.id, query);
  }

  @Get('job-postings/:id')
  @Public()
  @DefaultResponse(JobPostingResponseDto, 'Get job success', HttpStatus.OK, [
    JOB_NOT_FOUND,
  ])
  findPublicOne(
    @Req() req: OptionalAuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.findPublicOne(id, req.user?.id);
  }

  @Put('job-postings/:id/save')
  @ApiBearerAuth()
  @DefaultResponse(
    SaveJobPostingResponseDto,
    'Save job posting success',
    HttpStatus.OK,
    [JOB_NOT_FOUND],
  )
  save(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.save(req.user.id, id);
  }

  @Delete('job-postings/:id/save')
  @ApiBearerAuth()
  // Unsaving is idempotent: an unsaved or unknown job also answers 200.
  @DefaultResponse(
    SaveJobPostingResponseDto,
    'Unsave job posting success',
    HttpStatus.OK,
    [],
  )
  unsave(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.unsave(req.user.id, id);
  }

  @Post('merchant/job-postings')
  @ApiBearerAuth()
  @DefaultResponse(
    JobPostingResponseDto,
    'Create job posting success',
    HttpStatus.CREATED,
    [BadRequestException, MERCHANT_NOT_ACTIVE, MERCHANT_NOT_FOUND],
  )
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateJobPostingDto) {
    return this.jobPostingService.create(req.user.id, input);
  }

  @Get('merchant/job-postings')
  @ApiBearerAuth()
  @PaginatedResponse(JobPostingResponseDto, 'Get job postings success', [
    BadRequestException,
    MERCHANT_NOT_FOUND,
  ])
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.jobPostingService.findMine(req.user.id, query);
  }

  @Get('merchant/job-postings/:id')
  @ApiBearerAuth()
  @DefaultResponse(
    JobPostingResponseDto,
    'Get job posting success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND, JOB_NOT_FOUND],
  )
  findMineOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.findMineOne(req.user.id, id);
  }

  @Patch('merchant/job-postings/:id')
  @ApiBearerAuth()
  @DefaultResponse(
    JobPostingResponseDto,
    'Update job posting success',
    HttpStatus.OK,
    [
      BadRequestException,
      MERCHANT_NOT_ACTIVE,
      MERCHANT_NOT_FOUND,
      JOB_NOT_FOUND,
    ],
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateJobPostingDto,
  ) {
    return this.jobPostingService.update(req.user.id, id, input);
  }

  @Post('merchant/job-postings/:id/close')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @DefaultResponse(
    JobPostingResponseDto,
    'Close job posting success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND, JOB_NOT_FOUND],
  )
  close(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.close(req.user.id, id);
  }
}
