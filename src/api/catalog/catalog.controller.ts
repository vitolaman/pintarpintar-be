import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  ArrayResponse,
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { CatalogService } from './catalog.service';
import {
  CatalogCardDto,
  CatalogClassDetailDto,
  CatalogDigitalDetailDto,
  CatalogQueryDto,
  CategoryNodeDto,
} from './dto/catalog.dto';

// Public routes still read a valid token when one is sent.
type OptionalAuthRequest = { user?: { id: string } };

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

  @Get('get-categories')
  @Public()
  @ArrayResponse(CategoryNodeDto, 'Get categories success')
  findCategories() {
    return this.catalogService.findCategories();
  }

  @Get('get-class/:id')
  @Public()
  @DefaultResponse(CatalogClassDetailDto, 'Get class success', HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
  ])
  findClass(
    @Req() req: OptionalAuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.findClass(id, req.user?.id);
  }

  @Get('get-digital-product/:id')
  @Public()
  @DefaultResponse(
    CatalogDigitalDetailDto,
    'Get digital product success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findDigitalProduct(
    @Req() req: OptionalAuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.findDigitalProduct(id, req.user?.id);
  }
}
