import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
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

// Only an account deleted while its request is in flight answers this.
const USER_NOT_FOUND = new NotFoundException('User not found');

@Controller('api/v1/help-tickets')
@ApiBearerAuth()
@ApiTags('Help Tickets')
export class HelpTicketController {
  constructor(private readonly helpTicketService: HelpTicketService) {}

  // Public: feedback from the help page is anonymous unless a token is sent.
  // At most 5 submissions per visitor address per 10 minutes.
  @Post()
  @Public()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @DefaultResponse(
    HelpTicketResponseDto,
    'Create help ticket success',
    HttpStatus.CREATED,
    [USER_NOT_FOUND],
  )
  create(
    @Req() req: { user?: { id: string } },
    @Body() input: CreateHelpTicketDto,
  ) {
    return this.helpTicketService.create(req.user?.id ?? null, input);
  }

  @Get()
  @PaginatedResponse(HelpTicketResponseDto, 'Get help tickets success', [
    USER_NOT_FOUND,
  ])
  findAll(
    @Req() req: { user: { id: string } },
    @Query() query: RequestPaginatedQueryDto,
  ) {
    return this.helpTicketService.findAll(req.user.id, query.page, query.limit);
  }

  @Get(':id')
  @DefaultResponse(
    HelpTicketResponseDto,
    'Get help ticket success',
    HttpStatus.OK,
    [
      BadRequestException,
      USER_NOT_FOUND,
      new NotFoundException('Help ticket not found'),
    ],
  )
  findOne(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.helpTicketService.findOne(req.user.id, id);
  }
}
