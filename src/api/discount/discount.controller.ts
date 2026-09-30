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
  UpdateDiscountDto,
} from './dto/discount-request.dto';
import {
  DiscountResponseDto,
  DiscountTargetResponseDto,
} from './dto/discount-response.dto';

type AuthenticatedRequest = { user: { id: string } };

@Controller('discounts/v1')
@ApiBearerAuth()
@ApiTags('Merchant Discounts')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Get('get-eligible-products')
  @ArrayResponse(DiscountTargetResponseDto, 'Get eligible products success', [
    NotFoundException,
  ])
  findEligibleProducts(@Req() req: AuthenticatedRequest) {
    return this.discountService.findEligibleProducts(req.user.id);
  }

  @Post('create-discount')
  @DefaultResponse(
    DiscountResponseDto,
    'Create discount success',
    HttpStatus.CREATED,
    [BadRequestException, NotFoundException],
  )
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateDiscountDto) {
    return this.discountService.create(req.user.id, input);
  }

  @Get('get-discounts')
  @PaginatedResponse(DiscountResponseDto, 'Get discounts success', [
    BadRequestException,
    NotFoundException,
  ])
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: DiscountListQueryDto,
  ) {
    return this.discountService.findAll(req.user.id, query);
  }

  @Get('get-discount/:id')
  @DefaultResponse(DiscountResponseDto, 'Get discount success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.discountService.findOne(req.user.id, id);
  }

  @Patch('update-discount/:id')
  @DefaultResponse(
    DiscountResponseDto,
    'Update discount success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDiscountDto,
  ) {
    return this.discountService.update(req.user.id, id, input);
  }

  @Delete('delete-discount/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([BadRequestException, NotFoundException])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.discountService.remove(req.user.id, id);
  }

  @Post('add-discount-codes/:id')
  @DefaultResponse(
    DiscountResponseDto,
    'Add discount codes success',
    HttpStatus.CREATED,
    [BadRequestException, NotFoundException],
  )
  addCodes(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddDiscountCodesDto,
  ) {
    return this.discountService.addCodes(req.user.id, id, input);
  }

  @Delete('delete-discount-code/:codeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([BadRequestException, NotFoundException])
  removeCode(
    @Req() req: AuthenticatedRequest,
    @Param('codeId', ParseUUIDPipe) codeId: string,
  ) {
    return this.discountService.removeCode(req.user.id, codeId);
  }
}
