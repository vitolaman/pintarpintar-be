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
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
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
  CatalogItemCardDto,
  CatalogQueryDto,
  CategoryNodeDto,
} from './dto/catalog.dto';

// Public routes still read a valid token when one is sent.
type OptionalAuthRequest = { user?: { id: string } };

@Controller('api/v1/catalog')
@ApiTags('Catalog')
// Kept in the contract: generated clients may still name the base card type.
@ApiExtraModels(CatalogCardDto)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('items')
  @Public()
  @PaginatedResponse(CatalogItemCardDto, 'Get catalog items success', [
    BadRequestException,
  ])
  findItems(@Req() req: OptionalAuthRequest, @Query() query: CatalogQueryDto) {
    return this.catalogService.findItems(query, req.user?.id);
  }

  @Get('categories')
  @Public()
  @ArrayResponse(CategoryNodeDto, 'Get categories success')
  findCategories() {
    return this.catalogService.findCategories();
  }

  @Get('classes/:id')
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

  @Get('digital-products/:id')
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
