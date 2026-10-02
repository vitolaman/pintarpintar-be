import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginatedResponse } from '~/common/decorator/response.decorator';
import { PortalItemQueryDto } from './dto/portal-item-query.dto';
import { PortalItemResponseDto } from './dto/portal-item-response.dto';
import { PortalService } from './portal.service';

@Controller('api/v1/profile')
@ApiBearerAuth()
@ApiTags('Portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('portal-items')
  @PaginatedResponse(PortalItemResponseDto, 'Get portal items success', [
    BadRequestException,
  ])
  findItems(
    @Req() req: { user: { id: string } },
    @Query() query: PortalItemQueryDto,
  ) {
    return this.portalService.findItems(req.user.id, query);
  }
}
