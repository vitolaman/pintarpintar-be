import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { Public } from '~/common/decorator/public.decorator';
import { ClientAddressThrottlerGuard } from '~/common/guard/client-address-throttler.guard';
import { CreateHelpTicketDto } from './dto/create-help-ticket.dto';
import { HelpTicketResponseDto } from './dto/help-ticket-response.dto';
import { HelpTicketService } from './help-ticket.service';

@Controller('help-tickets/v1')
@ApiBearerAuth()
@ApiTags('Help Tickets')
export class HelpTicketController {
  constructor(private readonly helpTicketService: HelpTicketService) {}

  // Public: feedback from the help page is anonymous unless a token is sent.
  // At most 5 submissions per visitor address per 10 minutes.
  @Post('create-help-ticket')
  @Public()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @DefaultResponse(
    HelpTicketResponseDto,
    'Create help ticket success',
    HttpStatus.CREATED,
  )
  create(
    @Req() req: { user?: { id: string } },
    @Body() input: CreateHelpTicketDto,
  ) {
    return this.helpTicketService.create(req.user?.id ?? null, input);
  }

  @Get('get-help-tickets')
  @PaginatedResponse(HelpTicketResponseDto, 'Get help tickets success', [
    NotFoundException,
  ])
  findAll(
    @Req() req: { user: { id: string } },
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.helpTicketService.findAll(req.user.id, query.page, query.limit);
  }

  @Get('get-help-ticket/:id')
  @DefaultResponse(
    HelpTicketResponseDto,
    'Get help ticket success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.helpTicketService.findOne(req.user.id, id);
  }
}
