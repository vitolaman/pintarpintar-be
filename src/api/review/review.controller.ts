import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  ClassReviewSummaryDto,
  CreateReviewDto,
  MerchantReviewSummaryDto,
  ReviewListQueryDto,
  ReviewResponseDto,
} from './dto/review.dto';
import { ReviewService } from './review.service';

@Controller('api/v1/reviews')
@ApiTags('Reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiBearerAuth()
  @DefaultResponse(
    ReviewResponseDto,
    'Create review success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      ForbiddenException,
      NotFoundException,
      ConflictException,
    ],
  )
  create(@Req() req: { user: { id: string } }, @Body() input: CreateReviewDto) {
    return this.reviewService.create(req.user.id, input);
  }

  @Get('classes/:classId')
  @Public()
  @DefaultResponse(
    ClassReviewSummaryDto,
    'Get class reviews success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findClassReviews(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewService.findClassReviews(classId, query);
  }

  @Get('digital-products/:productId')
  @Public()
  @DefaultResponse(
    ClassReviewSummaryDto,
    'Get product reviews success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findProductReviews(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewService.findProductReviews(productId, query);
  }

  @Get('merchants/:merchantId')
  @Public()
  @DefaultResponse(
    MerchantReviewSummaryDto,
    'Get merchant reviews success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findMerchantReviews(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewService.findMerchantReviews(merchantId, query);
  }
}
