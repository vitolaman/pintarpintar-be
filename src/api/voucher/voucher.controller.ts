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
  Patch,
  Post,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
  EmptyResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { PublicVoucherQueryDto } from './dto/voucher-query.dto';
import {
  PublicVoucherResponseDto,
  VoucherResponseDto,
} from './dto/voucher-response.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherService } from './voucher.service';

const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const VOUCHER_NOT_FOUND = new NotFoundException('Voucher not found');
const CODE_CONFLICT = new ConflictException('Voucher code already exists');

@Controller('api/v1')
@ApiTags('Vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post('merchant/vouchers')
  @ApiBearerAuth()
  @DefaultResponse(
    VoucherResponseDto,
    'Create voucher success',
    HttpStatus.CREATED,
    [BadRequestException, CODE_CONFLICT, MERCHANT_NOT_FOUND],
  )
  create(
    @Req() req: { user: { id: string } },
    @Body() input: CreateVoucherDto,
  ) {
    return this.voucherService.create(req.user.id, input);
  }

  @Get('merchant/vouchers')
  @ApiBearerAuth()
  @PaginatedResponse(VoucherResponseDto, 'Get vouchers success', [
    MERCHANT_NOT_FOUND,
  ])
  findAll(
    @Req() req: { user: { id: string } },
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.voucherService.findAll(req.user.id, query.page, query.limit);
  }

  @Get('merchant/vouchers/:id')
  @ApiBearerAuth()
  @DefaultResponse(VoucherResponseDto, 'Get voucher success', HttpStatus.OK, [
    MERCHANT_NOT_FOUND,
    VOUCHER_NOT_FOUND,
  ])
  findOne(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.voucherService.findOne(req.user.id, id);
  }

  @Patch('merchant/vouchers/:id')
  @ApiBearerAuth()
  @DefaultResponse(
    VoucherResponseDto,
    'Update voucher success',
    HttpStatus.OK,
    [BadRequestException, CODE_CONFLICT, MERCHANT_NOT_FOUND, VOUCHER_NOT_FOUND],
  )
  update(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVoucherDto,
  ) {
    return this.voucherService.update(req.user.id, id, input);
  }

  @Delete('merchant/vouchers/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([MERCHANT_NOT_FOUND, VOUCHER_NOT_FOUND])
  remove(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.voucherService.remove(req.user.id, id);
  }

  @Get('vouchers')
  @Public()
  @PaginatedResponse(PublicVoucherResponseDto, 'Get public vouchers success')
  findPublic(
    @Req() req: { user?: { id: string } },
    @Query() query: PublicVoucherQueryDto,
  ) {
    return this.voucherService.findPublic(query, req.user?.id);
  }

  @Get('vouchers/featured')
  @Public()
  @ArrayResponse(PublicVoucherResponseDto, 'Get featured vouchers success')
  findFeatured(@Req() req: { user?: { id: string } }) {
    return this.voucherService.findFeatured(req.user?.id);
  }

  // Only claimed vouchers that are still usable.
  @Get('vouchers/claimed')
  @ApiBearerAuth()
  @PaginatedResponse(PublicVoucherResponseDto, 'Get claimed vouchers success')
  findClaimed(
    @Req() req: { user: { id: string } },
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.voucherService.findClaimed(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  // Claiming again changes nothing; a claim reserves no use.
  @Post('vouchers/:id/claim')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    PublicVoucherResponseDto,
    'Claim voucher success',
    HttpStatus.OK,
    [VOUCHER_NOT_FOUND],
  )
  claim(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.voucherService.claim(req.user.id, id);
  }

  // Removing a missing claim changes nothing.
  @Delete('vouchers/:id/claim')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([])
  unclaim(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.voucherService.unclaim(req.user.id, id);
  }
}
