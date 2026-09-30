import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { HomeCollectionQueryDto } from './dto/home-collection-query.dto';
import { CatalogCardDto } from '../catalog/dto/catalog.dto';
import {
  HomeMerchantCardResponseDto,
  HomeStatisticsResponseDto,
  HomeTestimonialResponseDto,
} from './dto/home-response.dto';
import { HomeService } from './home.service';

@Controller('home/v1')
@ApiTags('Home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('get-statistics')
  @Public()
  @DefaultResponse(
    HomeStatisticsResponseDto,
    'Get home statistics success',
    HttpStatus.OK,
  )
  getStatistics() {
    return this.homeService.getStatistics();
  }

  @Get('get-bootcamps')
  @Public()
  @ArrayResponse(CatalogCardDto, 'Get bootcamps success')
  getBootcamps(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getBootcamps(query.limit);
  }

  @Get('get-video-classes')
  @Public()
  @ArrayResponse(CatalogCardDto, 'Get video classes success')
  getVideoClasses(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getVideoClasses(query.limit);
  }

  @Get('get-digital-products')
  @Public()
  @ArrayResponse(CatalogCardDto, 'Get digital products success')
  getDigitalProducts(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getDigitalProducts(query.limit);
  }

  @Get('get-merchants')
  @Public()
  @ArrayResponse(HomeMerchantCardResponseDto, 'Get merchants success')
  getMerchants(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getMerchants(query.limit);
  }

  @Get('get-testimonials')
  @Public()
  @ArrayResponse(HomeTestimonialResponseDto, 'Get testimonials success')
  getTestimonials(@Query() query: HomeCollectionQueryDto) {
    return this.homeService.getTestimonials(query.limit);
  }
}
