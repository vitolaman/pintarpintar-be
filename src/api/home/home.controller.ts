import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { HomeService } from './home.service';
import { GetHomeQueryDto } from './dto/get-home-query.dto';
import { HomeResponseDto } from './dto/home-response.dto';

@Controller('home/v1')
@ApiTags('Home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('get-home')
  @Public()
  @DefaultResponse(HomeResponseDto, 'Get home success', HttpStatus.OK, [])
  getHome(@Query() query: GetHomeQueryDto) {
    return this.homeService.getHome(query.limit);
  }
}
