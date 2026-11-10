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
  CreateMerchantRegistrationRequestDto,
  MerchantRegistrationRequestResponseDto,
} from './dto/merchant-registration-request.dto';
import { MerchantRegistrationRequestService } from './merchant-registration-request.service';

@Controller('api/v1/merchant-registration-requests')
@ApiBearerAuth()
@ApiTags('Merchant Registration Requests')
export class MerchantRegistrationRequestController {
  constructor(private readonly service: MerchantRegistrationRequestService) {}

  @Post()
  @DefaultResponse(
    MerchantRegistrationRequestResponseDto,
    'Create merchant registration request success',
    HttpStatus.CREATED,
    [new NotFoundException('User not found')],
  )
  create(
    @Req() req: { user: { id: string } },
    @Body() input: CreateMerchantRegistrationRequestDto,
  ) {
    return this.service.create(req.user.id, input);
  }

  @Get()
  @PaginatedResponse(
    MerchantRegistrationRequestResponseDto,
    'Get merchant registration requests success',
  )
  findAll(@Query() query: RequestPaginatedQueryDto) {
    return this.service.findAll(query.page, query.limit);
  }
}
