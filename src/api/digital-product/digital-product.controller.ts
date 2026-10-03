import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
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
import {
  DefaultResponse,
  EmptyResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { DigitalProductService } from './digital-product.service';
import {
  CreateDigitalProductDto,
  DigitalProductListQueryDto,
  UpdateDigitalProductDto,
} from './dto/digital-product-request.dto';
import { DigitalProductResponseDto } from './dto/digital-product-response.dto';

type AuthenticatedRequest = { user: { id: string } };
const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const PRODUCT_ERRORS = [
  BadRequestException,
  MERCHANT_NOT_FOUND,
  new NotFoundException('Digital product not found'),
];

@Controller('api/v1/merchant/digital-products')
@ApiBearerAuth()
@ApiTags('Merchant Digital Products')
export class DigitalProductController {
  constructor(private readonly digitalProductService: DigitalProductService) {}

  @Get()
  @PaginatedResponse(
    DigitalProductResponseDto,
    'Get digital products success',
    [BadRequestException, MERCHANT_NOT_FOUND],
  )
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: DigitalProductListQueryDto,
  ) {
    return this.digitalProductService.findAll(req.user.id, query);
  }

  @Get(':id')
  @DefaultResponse(
    DigitalProductResponseDto,
    'Get digital product success',
    HttpStatus.OK,
    PRODUCT_ERRORS,
  )
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.digitalProductService.findOne(req.user.id, id);
  }

  @Post()
  @DefaultResponse(
    DigitalProductResponseDto,
    'Create digital product success',
    HttpStatus.CREATED,
    [BadRequestException, MERCHANT_NOT_FOUND],
  )
  create(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreateDigitalProductDto,
  ) {
    return this.digitalProductService.create(req.user.id, input);
  }

  @Patch(':id')
  @DefaultResponse(
    DigitalProductResponseDto,
    'Update digital product success',
    HttpStatus.OK,
    PRODUCT_ERRORS,
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDigitalProductDto,
  ) {
    return this.digitalProductService.update(req.user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    ...PRODUCT_ERRORS,
    new ConflictException(
      'Remove this product from its active bundles before deleting it',
    ),
  ])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.digitalProductService.remove(req.user.id, id);
  }
}
