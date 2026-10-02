import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { HomeCollectionQueryDto } from './dto/home-collection-query.dto';
import { CatalogItemCardDto } from '../catalog/dto/catalog.dto';
import {
  HomeMerchantCardResponseDto,
  HomeStatisticsResponseDto,
  HomeTestimonialResponseDto,
} from './dto/home-response.dto';
import { HomeService } from './home.service';

@Controller('api/v1/home')
@ApiTags('Home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('statistics')
  @Public()
  @DefaultResponse(
    HomeStatisticsResponseDto,
    'Get home statistics success',
    HttpStatus.OK,
  )
  getStatistics() {
    return this.homeService.getStatistics();
  }

  @Get('bootcamps')
  @Public()
  @ArrayResponse(CatalogItemCardDto, 'Get bootcamps success')
  getBootcamps(
    @Req() req: { user?: { id: string } },
    @Query() query: HomeCollectionQueryDto,
  ) {
    return this.homeService.getBootcamps(query.limit, req.user?.id);
  }

  @Get('video-classes')
  @Public()
  @ArrayResponse(CatalogItemCardDto, 'Get video classes success')
  getVideoClasses(
    @Req() req: { user?: { id: string } },
    @Query() query: HomeCollectionQueryDto,
  ) {
    return this.homeService.getVideoClasses(query.limit, req.user?.id);
  }

  @Get('digital-products')
  @Public()
  @ArrayResponse(CatalogItemCardDto, 'Get digital products success')
  getDigitalProducts(
    @Req() req: { user?: { id: string } },
    @Query() query: HomeCollectionQueryDto,
  ) {
    return this.homeService.getDigitalProducts(query.limit, req.user?.id);
  }

  @Get('merchants')
  @Public()
  @ArrayResponse(HomeMerchantCardResponseDto, 'Get merchants success')
  getMerchants(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getMerchants(query.limit);
  }

  @Get('testimonials')
  @Public()
  @ArrayResponse(HomeTestimonialResponseDto, 'Get testimonials success')
  getTestimonials(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getTestimonials(query.limit);
  }
}
