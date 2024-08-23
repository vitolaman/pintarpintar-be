import { Controller, Get, Query } from '@nestjs/common';
import { MasterCountryService } from './master-country.service';
import { GetMasterCountryDto } from './dto/get-master-country.dto';
import { PaginatedResponse } from '~/common/decorator/response.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { MasterCountry } from './entities/master-country.entity';
import { Public } from '~/common/decorator/public.decorator';

@Controller('master-country')
export class MasterCountryController {
  constructor(private readonly masterCountryService: MasterCountryService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get All Master Country',
  })
  @PaginatedResponse(MasterCountry, 'Get country list success', [])
  async findAll(@Query() req: GetMasterCountryDto) {
    return await this.masterCountryService.findAll(req);
  }
}
