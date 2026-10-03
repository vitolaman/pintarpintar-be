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
import { Public } from '~/common/decorator/public.decorator';
import { BundleService } from './bundle.service';
import {
  BundleListQueryDto,
  CreateBundleDto,
  PublicBundleQueryDto,
  UpdateBundleDto,
} from './dto/bundle-request.dto';
import {
  BundleItemResponseDto,
  BundleResponseDto,
  PublicBundleResponseDto,
} from './dto/bundle-response.dto';

type AuthenticatedRequest = { user: { id: string } };
const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const BUNDLE_NOT_FOUND = new NotFoundException('Bundle not found');

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Merchant Bundles')
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  @Get('bundles')
  @Public()
  @PaginatedResponse(PublicBundleResponseDto, 'Get public bundles success', [
    BadRequestException,
  ])
  findPublic(@Query() query: PublicBundleQueryDto) {
    return this.bundleService.findPublic(query);
  }

  @Get('merchant/bundles/eligible-items')
  @ArrayResponse(BundleItemResponseDto, 'Get eligible bundle items success', [
    MERCHANT_NOT_FOUND,
  ])
  findEligibleItems(@Req() req: AuthenticatedRequest) {
    return this.bundleService.findEligibleItems(req.user.id);
  }

  @Post('merchant/bundles')
  @DefaultResponse(
    BundleResponseDto,
    'Create bundle success',
    HttpStatus.CREATED,
    [BadRequestException, MERCHANT_NOT_FOUND],
  )
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateBundleDto) {
    return this.bundleService.create(req.user.id, input);
  }

  @Get('merchant/bundles')
  @PaginatedResponse(BundleResponseDto, 'Get bundles success', [
    BadRequestException,
    MERCHANT_NOT_FOUND,
  ])
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: BundleListQueryDto,
  ) {
    return this.bundleService.findAll(req.user.id, query);
  }

  @Get('merchant/bundles/:id')
  @DefaultResponse(BundleResponseDto, 'Get bundle success', HttpStatus.OK, [
    BadRequestException,
    MERCHANT_NOT_FOUND,
    BUNDLE_NOT_FOUND,
  ])
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bundleService.findOne(req.user.id, id);
  }

  @Patch('merchant/bundles/:id')
  @DefaultResponse(BundleResponseDto, 'Update bundle success', HttpStatus.OK, [
    BadRequestException,
    MERCHANT_NOT_FOUND,
    BUNDLE_NOT_FOUND,
  ])
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateBundleDto,
  ) {
    return this.bundleService.update(req.user.id, id, input);
  }

  @Delete('merchant/bundles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([BadRequestException, MERCHANT_NOT_FOUND, BUNDLE_NOT_FOUND])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bundleService.remove(req.user.id, id);
  }
}
