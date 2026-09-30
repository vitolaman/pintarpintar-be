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
import { BundleService } from './bundle.service';
import {
  BundleListQueryDto,
  CreateBundleDto,
  UpdateBundleDto,
} from './dto/bundle-request.dto';
import {
  BundleItemResponseDto,
  BundleResponseDto,
} from './dto/bundle-response.dto';

type AuthenticatedRequest = { user: { id: string } };

@Controller('bundles/v1')
@ApiBearerAuth()
@ApiTags('Merchant Bundles')
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  @Get('get-eligible-items')
  @ArrayResponse(BundleItemResponseDto, 'Get eligible bundle items success', [
    NotFoundException,
  ])
  findEligibleItems(@Req() req: AuthenticatedRequest) {
    return this.bundleService.findEligibleItems(req.user.id);
  }

  @Post('create-bundle')
  @DefaultResponse(
    BundleResponseDto,
    'Create bundle success',
    HttpStatus.CREATED,
    [BadRequestException, NotFoundException],
  )
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateBundleDto) {
    return this.bundleService.create(req.user.id, input);
  }

  @Get('get-bundles')
  @PaginatedResponse(BundleResponseDto, 'Get bundles success', [
    BadRequestException,
    NotFoundException,
  ])
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: BundleListQueryDto,
  ) {
    return this.bundleService.findAll(req.user.id, query);
  }

  @Get('get-bundle/:id')
  @DefaultResponse(BundleResponseDto, 'Get bundle success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bundleService.findOne(req.user.id, id);
  }

  @Patch('update-bundle/:id')
  @DefaultResponse(BundleResponseDto, 'Update bundle success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateBundleDto,
  ) {
    return this.bundleService.update(req.user.id, id, input);
  }

  @Delete('delete-bundle/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([BadRequestException, NotFoundException])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bundleService.remove(req.user.id, id);
  }
}
