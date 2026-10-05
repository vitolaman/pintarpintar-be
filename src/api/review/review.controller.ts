import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerException } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  DefaultResponse,
  PaginatedObjectResponse,
} from '~/common/decorator/response.decorator';
import {
  ClientAddressThrottlerGuard,
  TOO_MANY_REQUESTS_MESSAGE,
} from '~/common/guard/client-address-throttler.guard';
import {
  ClassReviewSummaryDto,
  CreateReviewDto,
  CreateReviewReplyDto,
  MerchantReviewSummaryDto,
  ReviewHelpfulDto,
  ReviewListQueryDto,
  ReviewReplyDto,
  ReviewResponseDto,
} from './dto/review.dto';
import { ReviewService } from './review.service';

const CLASS_NOT_FOUND = new NotFoundException('Class not found');
const PRODUCT_NOT_FOUND = new NotFoundException('Digital product not found');
const REVIEW_NOT_FOUND = new NotFoundException('Review not found');

type OptionalAuthRequest = { user?: { id: string } };

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
      new ForbiddenException('Only enrolled learners can review'),
      new ForbiddenException('Only buyers can review this product'),
      CLASS_NOT_FOUND,
      PRODUCT_NOT_FOUND,
      new ConflictException('You have already reviewed this class'),
      new ConflictException('You have already reviewed this product'),
    ],
  )
  create(@Req() req: { user: { id: string } }, @Body() input: CreateReviewDto) {
    return this.reviewService.create(req.user.id, input);
  }

  @Get('classes/:classId')
  @Public()
  @PaginatedObjectResponse(ClassReviewSummaryDto, 'Get class reviews success', [
    BadRequestException,
    CLASS_NOT_FOUND,
  ])
  findClassReviews(
    @Req() req: OptionalAuthRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewService.findClassReviews(classId, query, req.user?.id);
  }

  @Get('digital-products/:productId')
  @Public()
  @PaginatedObjectResponse(
    ClassReviewSummaryDto,
    'Get product reviews success',
    [BadRequestException, PRODUCT_NOT_FOUND],
  )
  findProductReviews(
    @Req() req: OptionalAuthRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewService.findProductReviews(
      productId,
      query,
      req.user?.id,
    );
  }

  @Put(':id/helpful')
  @ApiBearerAuth()
  @DefaultResponse(
    ReviewHelpfulDto,
    'Mark review helpful success',
    HttpStatus.OK,
    [
      BadRequestException,
      new ForbiddenException('You cannot mark your own review as helpful'),
      REVIEW_NOT_FOUND,
    ],
  )
  markHelpful(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviewService.markHelpful(req.user.id, id);
  }

  @Delete(':id/helpful')
  @ApiBearerAuth()
  @DefaultResponse(
    ReviewHelpfulDto,
    'Unmark review helpful success',
    HttpStatus.OK,
    [BadRequestException, REVIEW_NOT_FOUND],
  )
  unmarkHelpful(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviewService.unmarkHelpful(req.user.id, id);
  }

  @Post(':id/replies')
  @ApiBearerAuth()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @DefaultResponse(
    ReviewReplyDto,
    'Create review reply success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      new ForbiddenException(
        'Only buyers, the merchant and the class mentors can reply',
      ),
      REVIEW_NOT_FOUND,
      new ThrottlerException(TOO_MANY_REQUESTS_MESSAGE),
    ],
  )
  reply(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateReviewReplyDto,
  ) {
    return this.reviewService.reply(req.user.id, id, input);
  }

  @Get('merchants/:merchantId')
  @Public()
  @PaginatedObjectResponse(
    MerchantReviewSummaryDto,
    'Get merchant reviews success',
    [BadRequestException, new NotFoundException('Merchant not found')],
  )
  findMerchantReviews(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewService.findMerchantReviews(merchantId, query);
  }
}
