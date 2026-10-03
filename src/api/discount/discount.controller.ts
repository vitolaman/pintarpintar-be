import {
  BadRequestException,
  Body,
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
  ArrayResponse,
  DefaultResponse,
  EmptyResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { DiscountService } from './discount.service';
import {
  AddDiscountCodesDto,
  CreateDiscountDto,
  DiscountListQueryDto,
  RemoveDiscountCodesDto,
  UpdateDiscountDto,
} from './dto/discount-request.dto';
import {
  DiscountEligibleItemResponseDto,
  DiscountResponseDto,
} from './dto/discount-response.dto';

type AuthenticatedRequest = { user: { id: string } };
const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const DISCOUNT_ERRORS = [
  BadRequestException,
  MERCHANT_NOT_FOUND,
  new NotFoundException('Discount not found'),
];

@Controller('api/v1/merchant')
@ApiBearerAuth()
@ApiTags('Merchant Discounts')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Get('discounts/eligible-items')
  @ArrayResponse(
    DiscountEligibleItemResponseDto,
    'Get eligible products success',
    [MERCHANT_NOT_FOUND],
  )
  findEligibleProducts(@Req() req: AuthenticatedRequest) {
    return this.discountService.findEligibleProducts(req.user.id);
  }

  @Post('discounts')
  @DefaultResponse(
    DiscountResponseDto,
    'Create discount success',
    HttpStatus.CREATED,
    [BadRequestException, MERCHANT_NOT_FOUND],
  )
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateDiscountDto) {
    return this.discountService.create(req.user.id, input);
  }

  @Get('discounts')
  @PaginatedResponse(DiscountResponseDto, 'Get discounts success', [
    BadRequestException,
    MERCHANT_NOT_FOUND,
  ])
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: DiscountListQueryDto,
  ) {
    return this.discountService.findAll(req.user.id, query);
  }

  @Get('discounts/:id')
  @DefaultResponse(
    DiscountResponseDto,
    'Get discount success',
    HttpStatus.OK,
    DISCOUNT_ERRORS,
  )
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.discountService.findOne(req.user.id, id);
  }

  @Patch('discounts/:id')
  @DefaultResponse(
    DiscountResponseDto,
    'Update discount success',
    HttpStatus.OK,
    DISCOUNT_ERRORS,
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDiscountDto,
  ) {
    return this.discountService.update(req.user.id, id, input);
  }

  @Delete('discounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse(DISCOUNT_ERRORS)
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.discountService.remove(req.user.id, id);
  }

  @Post('discounts/:id/codes')
  @DefaultResponse(
    DiscountResponseDto,
    'Add discount codes success',
    HttpStatus.CREATED,
    DISCOUNT_ERRORS,
  )
  addCodes(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddDiscountCodesDto,
  ) {
    return this.discountService.addCodes(req.user.id, id, input);
  }

  @Post('discounts/:id/remove-codes')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    DiscountResponseDto,
    'Remove discount codes success',
    HttpStatus.OK,
    DISCOUNT_ERRORS,
  )
  removeCodes(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RemoveDiscountCodesDto,
  ) {
    return this.discountService.removeCodes(req.user.id, id, input);
  }

  @Delete('discount-codes/:codeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    BadRequestException,
    MERCHANT_NOT_FOUND,
    new NotFoundException('Discount code not found'),
  ])
  removeCode(
    @Req() req: AuthenticatedRequest,
    @Param('codeId', ParseUUIDPipe) codeId: string,
  ) {
    return this.discountService.removeCode(req.user.id, codeId);
  }
}
