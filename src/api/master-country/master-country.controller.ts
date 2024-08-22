import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { MasterCountryService } from './master-country.service';
import { GetMasterCountryDto } from './dto/get-master-country.dto';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        data: [
          {
            countryId: 30,
            countryName: 'British Indian Ocean Territory',
          },
          {
            countryId: 97,
            countryName: 'India',
          },
          {
            countryId: 98,
            countryName: 'Indonesia',
          },
        ],
      },
    },
  })
  @DefaultResponse(MasterCountry, HttpStatus.OK, [])
  async findAll(@Query() req: GetMasterCountryDto) {
    return await this.masterCountryService.findAll(req);
  }
}
