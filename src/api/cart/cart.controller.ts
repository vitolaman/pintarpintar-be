import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CatalogItemRefDto } from '~/common/catalog/catalog-item';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { ResponseDto } from '~/common/dto/response.dto-default';
import { CartService } from './cart.service';
import { CartResponseDto } from './dto/cart.dto';

type AuthenticatedRequest = { user: { id: string } };

@Controller('api/v1/cart')
@ApiBearerAuth()
@ApiTags('Cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @DefaultResponse(CartResponseDto, 'Get cart success', HttpStatus.OK, [])
  findCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.findCart(req.user.id);
  }

  // 201 when the item is added; 200 with the unchanged cart when it is
  // already there.
  @Post('items')
  @DefaultResponse(CartResponseDto, 'Add to cart success', HttpStatus.CREATED, [
    BadRequestException,
  ])
  @ApiOkResponse({
    description: 'The item is already in the cart; the cart is unchanged',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CartResponseDto) },
            responseMessage: {
              type: 'string',
              example: 'Item already in cart',
            },
          },
        },
      ],
    },
  })
  async add(
    @Req() req: AuthenticatedRequest,
    @Body() input: CatalogItemRefDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, ...cart } = await this.cartService.add(req.user.id, input);
    if (!created) res.status(HttpStatus.OK);
    return cart;
  }

  @Delete('items/:id')
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description:
      'The cart entry id, or the id of the class, digital product or bundle in it',
  })
  @DefaultResponse(CartResponseDto, 'Remove cart item success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cartService.remove(req.user.id, id);
  }

  @Delete()
  @DefaultResponse(CartResponseDto, 'Clear cart success', HttpStatus.OK, [])
  clear(@Req() req: AuthenticatedRequest) {
    return this.cartService.clear(req.user.id);
  }
}
