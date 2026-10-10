import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '~/common/decorator/public.decorator';
import {
  DefaultResponse,
  PaginatedObjectResponse,
} from '~/common/decorator/response.decorator';
import {
  PlatformReviewListDto,
  PlatformReviewResponseDto,
  SavePlatformReviewDto,
} from './dto/platform-review.dto';
import { ReviewListQueryDto } from './dto/review.dto';
import {
  MERCHANT_NOT_ACTIVE,
  MERCHANT_NOT_FOUND,
  PlatformReviewService,
} from './platform-review.service';

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Platform Reviews')
export class PlatformReviewController {
  constructor(private readonly service: PlatformReviewService) {}

  @Get('merchant/platform-review')
  @DefaultResponse(
    PlatformReviewResponseDto,
    'Get platform review success; data is null until the store reviews',
    HttpStatus.OK,
    [new NotFoundException(MERCHANT_NOT_FOUND)],
  )
  findOwn(@Req() req: { user: { id: string } }) {
    return this.service.findOwn(req.user.id);
  }

  // 201 when the store's first review is created; 200 when it is replaced.
  @Put('merchant/platform-review')
  @DefaultResponse(
    PlatformReviewResponseDto,
    'Save platform review success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      new NotFoundException(MERCHANT_NOT_FOUND),
      new ForbiddenException(MERCHANT_NOT_ACTIVE),
    ],
  )
  @ApiOkResponse({ description: 'The existing review was replaced' })
  async save(
    @Req() req: { user: { id: string } },
    @Body() input: SavePlatformReviewDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, ...response } = await this.service.save(
      req.user.id,
      input,
    );
    // PUT answers 200 by default; a first review is a creation.
    if (created) res.status(HttpStatus.CREATED);
    return response;
  }

  @Get('platform-reviews')
  @Public()
  @PaginatedObjectResponse(
    PlatformReviewListDto,
    'Get platform reviews success',
    [BadRequestException],
  )
  findPublic(@Query() query: ReviewListQueryDto) {
    return this.service.findPublic(query);
  }
}
