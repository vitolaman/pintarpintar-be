import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { CatalogService } from './catalog.service';
import {
  CatalogCardDto,
  CatalogClassDetailDto,
  CatalogDigitalDetailDto,
  CatalogQueryDto,
} from './dto/catalog.dto';

@Controller('catalog/v1')
@ApiTags('Catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('get-items')
  @Public()
  @PaginatedResponse(CatalogCardDto, 'Get catalog items success', [
    BadRequestException,
  ])
  findItems(@Query() query: CatalogQueryDto) {
    return this.catalogService.findItems(query);
  }

  @Get('get-class/:id')
  @Public()
  @DefaultResponse(CatalogClassDetailDto, 'Get class success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  findClass(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findClass(id);
  }

  @Get('get-digital-product/:id')
  @Public()
  @DefaultResponse(
    CatalogDigitalDetailDto,
    'Get digital product success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findDigitalProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.findDigitalProduct(id);
  }
}
