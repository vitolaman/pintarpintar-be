import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
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

@Controller('api/v1')
@ApiTags('Karir Job Postings')
export class JobPostingController {
  constructor(private readonly jobPostingService: JobPostingService) {}

  @Get('job-postings')
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

  @Get('job-postings/:id')
  @Public()
  @DefaultResponse(JobPostingResponseDto, 'Get job success')
  findPublicOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobPostingService.findPublicOne(id);
  }

  @Post('merchant/job-postings')
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

  @Get('merchant/job-postings')
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

  @Get('merchant/job-postings/:id')
  @ApiBearerAuth()
  @DefaultResponse(JobPostingResponseDto, 'Get job posting success')
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
    [BadRequestException, ForbiddenException, NotFoundException],
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
  @DefaultResponse(JobPostingResponseDto, 'Close job posting success')
  close(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobPostingService.close(req.user.id, id);
  }
}
