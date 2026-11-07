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
  CreateMerchantProRequestDto,
  MerchantProRequestResponseDto,
} from './dto/merchant-pro-request.dto';
import { MerchantProRequestService } from './merchant-pro-request.service';

@Controller('api/v1/merchant-pro-requests')
@ApiBearerAuth()
@ApiTags('Merchant Pro Requests')
export class MerchantProRequestController {
  constructor(private readonly service: MerchantProRequestService) {}

  @Post()
  @DefaultResponse(
    MerchantProRequestResponseDto,
    'Create merchant Pro request success',
    HttpStatus.CREATED,
    [new NotFoundException('User not found')],
  )
  create(
    @Req() req: { user: { id: string } },
    @Body() input: CreateMerchantProRequestDto,
  ) {
    return this.service.create(req.user.id, input);
  }

  @Get()
  @PaginatedResponse(
    MerchantProRequestResponseDto,
    'Get merchant Pro requests success',
  )
  findAll(@Query() query: RequestPaginatedQueryDto) {
    return this.service.findAll(query.page, query.limit);
  }
}
