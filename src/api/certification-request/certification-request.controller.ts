import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import {
  CertificationRequestResponseDto,
  CreateCertificationRequestDto,
} from './dto/certification-request.dto';
import { CertificationRequestService } from './certification-request.service';

@Controller('api/v1/certification-requests')
@ApiBearerAuth()
@ApiTags('Certification Requests')
export class CertificationRequestController {
  constructor(private readonly service: CertificationRequestService) {}

  @Post()
  @DefaultResponse(
    CertificationRequestResponseDto,
    'Create certification request success',
    HttpStatus.CREATED,
    [new NotFoundException('User not found')],
  )
  create(
    @Req() req: { user: { id: string } },
    @Body() input: CreateCertificationRequestDto,
  ) {
    return this.service.create(req.user.id, input);
  }

  @Get()
  @PaginatedResponse(
    CertificationRequestResponseDto,
    'Get certification requests success',
  )
  findAll(@Query() query: RequestPaginatedQueryDto) {
    return this.service.findAll(query.page, query.limit);
  }
}
