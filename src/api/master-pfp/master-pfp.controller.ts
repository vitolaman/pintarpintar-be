import { Controller, Get, Req } from '@nestjs/common';
import { MasterPfpService } from './master-pfp.service';
import { Public } from '~/common/decorator/public.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { ArrayResponse } from '~/common/decorator/response.decorator';

@Controller('master-pfp')
export class MasterPfpController {
  constructor(private readonly masterPfpService: MasterPfpService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get All Master Profile Picture',
  })
  @ArrayResponse(MasterPfpService, 'Get master profile picture', [])
  async findAll(@Req() req) {
    const host = req.headers.host;
    const protocol = req.protocol;
    const prefixLink = `${protocol}://${host}`;

    return await this.masterPfpService.findAll(prefixLink);
  }
}
