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
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CatalogItemRefDto } from '~/common/catalog/catalog-item';
import {
  DefaultResponse,
  EmptyResponse,
} from '~/common/decorator/response.decorator';
import { CartService } from './cart.service';
import { CartResponseDto } from './dto/cart.dto';

type AuthenticatedRequest = { user: { id: string } };

@Controller('cart/v1')
@ApiBearerAuth()
@ApiTags('Cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('get-cart')
  @DefaultResponse(CartResponseDto, 'Get cart success', HttpStatus.OK, [])
  findCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.findCart(req.user.id);
  }

  @Post('add-to-cart')
  @DefaultResponse(CartResponseDto, 'Add to cart success', HttpStatus.CREATED, [
    BadRequestException,
    ConflictException,
  ])
  add(@Req() req: AuthenticatedRequest, @Body() input: CatalogItemRefDto) {
    return this.cartService.add(req.user.id, input);
  }

  @Delete('remove-from-cart/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([BadRequestException, NotFoundException])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cartService.remove(req.user.id, id);
  }

  @Delete('clear-cart')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([])
  clear(@Req() req: AuthenticatedRequest) {
    return this.cartService.clear(req.user.id);
  }
}
