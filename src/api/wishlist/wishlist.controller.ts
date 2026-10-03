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
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { CatalogItemRefDto } from '~/common/catalog/catalog-item';
import {
  DefaultResponse,
  EmptyResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { WishlistEntryResponseDto, WishlistQueryDto } from './dto/wishlist.dto';
import { WishlistService } from './wishlist.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('api/v1/wishlist')
@ApiBearerAuth()
@ApiTags('Wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @PaginatedResponse(WishlistEntryResponseDto, 'Get wishlist success', [
    BadRequestException,
  ])
  findAll(@Req() req: AuthenticatedRequest, @Query() query: WishlistQueryDto) {
    return this.wishlistService.findAll(req.user.id, query);
  }

  @Post('items')
  @DefaultResponse(
    WishlistEntryResponseDto,
    'Add to wishlist success',
    HttpStatus.CREATED,
    [BadRequestException],
  )
  add(@Req() req: AuthenticatedRequest, @Body() input: CatalogItemRefDto) {
    return this.wishlistService.add(req.user.id, input);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description:
      'The wishlist entry id, or the id of the class, digital product or bundle in it',
  })
  @EmptyResponse([
    BadRequestException,
    new NotFoundException('Wishlist item not found'),
  ])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wishlistService.remove(req.user.id, id);
  }
}
