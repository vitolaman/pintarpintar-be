import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  AnalyticsSummaryQueryDto,
  AnalyticsSummaryResponseDto,
  DailySalesQueryDto,
  DailySalesResponseDto,
  MonthlyRevenueQueryDto,
  MonthlyRevenueResponseDto,
  StudentGrowthQueryDto,
  StudentGrowthResponseDto,
} from './dto/merchant-analytics.dto';
import { MerchantAnalyticsService } from './merchant-analytics.service';

type AuthenticatedRequest = { user: { id: string } };
const ERRORS = [
  BadRequestException,
  new NotFoundException('Merchant not found'),
];

// The merchant "Analitik" page.
@Controller('api/v1/merchant/analytics')
@ApiBearerAuth()
@ApiTags('Merchant Analytics')
export class MerchantAnalyticsController {
  constructor(private readonly analyticsService: MerchantAnalyticsService) {}

  @Get('student-growth')
  @DefaultResponse(
    StudentGrowthResponseDto,
    'Get student growth success',
    200,
    ERRORS,
  )
  findStudentGrowth(
    @Req() req: AuthenticatedRequest,
    @Query() query: StudentGrowthQueryDto,
  ) {
    return this.analyticsService.findStudentGrowth(req.user.id, query);
  }

  @Get('daily-sales')
  @DefaultResponse(
    DailySalesResponseDto,
    'Get daily sales success',
    200,
    ERRORS,
  )
  findDailySales(
    @Req() req: AuthenticatedRequest,
    @Query() query: DailySalesQueryDto,
  ) {
    return this.analyticsService.findDailySales(req.user.id, query.month);
  }

  @Get('monthly-revenue')
  @DefaultResponse(
    MonthlyRevenueResponseDto,
    'Get monthly revenue success',
    200,
    ERRORS,
  )
  findMonthlyRevenue(
    @Req() req: AuthenticatedRequest,
    @Query() query: MonthlyRevenueQueryDto,
  ) {
    return this.analyticsService.findMonthlyRevenue(req.user.id, query.year);
  }

  @Get('summary')
  @DefaultResponse(
    AnalyticsSummaryResponseDto,
    'Get analytics summary success',
    200,
    ERRORS,
  )
  findSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: AnalyticsSummaryQueryDto,
  ) {
    return this.analyticsService.findSummary(req.user.id, query.period);
  }
}
