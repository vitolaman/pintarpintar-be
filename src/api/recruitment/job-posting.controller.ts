import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import { Public } from '~/common/decorator/public.decorator';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import {
  CreateJobPostingDto,
  JobBoardResponseDto,
  JobPostingResponseDto,
  PublicJobQueryDto,
  UpdateJobPostingDto,
} from './dto/job-posting.dto';
import { JobPostingService } from './job-posting.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('job-postings/v1')
@ApiTags('Karir Job Postings')
export class JobPostingController {
  constructor(private readonly jobPostingService: JobPostingService) {}

  @Get('get-public-jobs')
  @Public()
  @DefaultResponse(
    JobBoardResponseDto,
    'Get job board success',
    HttpStatus.OK,
    [BadRequestException],
  )
  findPublic(@Query() query: PublicJobQueryDto) {
    return this.jobPostingService.findPublic(query);
  }

  @Get('get-public-job/:id')
  @Public()
  @DefaultResponse(JobPostingResponseDto, 'Get job success')
  findPublicOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobPostingService.findPublicOne(id);
  }

  @Post('create-job')
  @ApiBearerAuth()
  @DefaultResponse(
    JobPostingResponseDto,
    'Create job posting success',
    HttpStatus.CREATED,
    [BadRequestException, ForbiddenException, NotFoundException],
  )
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateJobPostingDto) {
    return this.jobPostingService.create(req.user.id, input);
  }

  @Get('get-my-jobs')
  @ApiBearerAuth()
  @PaginatedResponse(JobPostingResponseDto, 'Get job postings success', [
    BadRequestException,
    NotFoundException,
  ])
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.jobPostingService.findMine(req.user.id, query);
  }

  @Get('get-my-job/:id')
  @ApiBearerAuth()
  @DefaultResponse(JobPostingResponseDto, 'Get job posting success')
  findMineOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.findMineOne(req.user.id, id);
  }

  @Patch('update-job/:id')
  @ApiBearerAuth()
  @DefaultResponse(
    JobPostingResponseDto,
    'Update job posting success',
    HttpStatus.OK,
    [BadRequestException, ForbiddenException, NotFoundException],
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateJobPostingDto,
  ) {
    return this.jobPostingService.update(req.user.id, id, input);
  }

  @Patch('close-job/:id')
  @ApiBearerAuth()
  @DefaultResponse(JobPostingResponseDto, 'Close job posting success')
  close(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.close(req.user.id, id);
  }
}
