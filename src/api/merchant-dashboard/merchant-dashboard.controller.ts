import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import {
  CustomersQueryDto,
  DashboardQueryDto,
  SalesFilterQueryDto,
  SalesQueryDto,
} from './dto/merchant-dashboard-query.dto';
import {
  CustomerResponseDto,
  MerchantDashboardResponseDto,
  SaleResponseDto,
  SalesExportResponseDto,
} from './dto/merchant-dashboard-response.dto';
import { MerchantDashboardService } from './merchant-dashboard.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('merchants/v1')
@ApiBearerAuth()
@ApiTags('Merchant Dashboard')
export class MerchantDashboardController {
  constructor(
    private readonly merchantDashboardService: MerchantDashboardService,
  ) {}

  @Get('get-dashboard')
  @DefaultResponse(
    MerchantDashboardResponseDto,
    'Get merchant dashboard success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: DashboardQueryDto,
  ) {
    return this.merchantDashboardService.findDashboard(req.user.id, query);
  }

  @Get('get-sales')
  @PaginatedResponse(SaleResponseDto, 'Get sales success', [
    BadRequestException,
    NotFoundException,
  ])
  findSales(@Req() req: AuthenticatedRequest, @Query() query: SalesQueryDto) {
    return this.merchantDashboardService.findSales(req.user.id, query);
  }

  @Get('export-sales')
  @DefaultResponse(
    SalesExportResponseDto,
    'Export sales success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  exportSales(
    @Req() req: AuthenticatedRequest,
    @Query() query: SalesFilterQueryDto,
  ) {
    return this.merchantDashboardService.exportSales(req.user.id, query);
  }

  @Get('get-customers')
  @PaginatedResponse(CustomerResponseDto, 'Get customers success', [
    BadRequestException,
    NotFoundException,
  ])
  findCustomers(
    @Req() req: AuthenticatedRequest,
    @Query() query: CustomersQueryDto,
  ) {
    return this.merchantDashboardService.findCustomers(req.user.id, query);
  }
}
