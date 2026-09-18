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

@Controller('vouchers/v1')
@ApiTags('Vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post('create-voucher')
  @ApiBearerAuth()
  @DefaultResponse(
    VoucherResponseDto,
    'Create voucher success',
    HttpStatus.CREATED,
    [BadRequestException, ConflictException, NotFoundException],
  )
  create(
    @Req() req: { user: { id: string } },
    @Body() input: CreateVoucherDto,
  ) {
    return this.voucherService.create(req.user.id, input);
  }

  @Get('get-vouchers')
  @ApiBearerAuth()
  @PaginatedResponse(VoucherResponseDto, 'Get vouchers success', [
    NotFoundException,
  ])
  findAll(
    @Req() req: { user: { id: string } },
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.voucherService.findAll(req.user.id, query.page, query.limit);
  }

  @Get('get-voucher/:id')
  @ApiBearerAuth()
  @DefaultResponse(VoucherResponseDto, 'Get voucher success', HttpStatus.OK, [
    NotFoundException,
  ])
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.voucherService.findOne(req.user.id, id);
  }

  @Patch('update-voucher/:id')
  @ApiBearerAuth()
  @DefaultResponse(
    VoucherResponseDto,
    'Update voucher success',
    HttpStatus.OK,
    [BadRequestException, ConflictException, NotFoundException],
  )
  update(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() input: UpdateVoucherDto,
  ) {
    return this.voucherService.update(req.user.id, id, input);
  }

  @Delete('delete-voucher/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([NotFoundException])
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.voucherService.remove(req.user.id, id);
  }

  @Get('get-public-vouchers')
  @Public()
  @PaginatedResponse(PublicVoucherResponseDto, 'Get public vouchers success')
  findPublic(@Query() query: PublicVoucherQueryDto) {
    return this.voucherService.findPublic(query);
  }

  @Get('get-featured-vouchers')
  @Public()
  @ArrayResponse(PublicVoucherResponseDto, 'Get featured vouchers success')
  findFeatured() {
    return this.voucherService.findFeatured();
  }
}
