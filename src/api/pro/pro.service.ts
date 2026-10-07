import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Merchant } from '~/api/merchant/entities/merchant.entity';
import {
  ProPeriodResponseDto,
  ProPlanResponseDto,
  ProSubscriptionResponseDto,
} from './dto/pro-response.dto';
import { MerchantProPeriod } from './entities/merchant-pro-period.entity';
import { ProPlan } from './entities/pro-plan.entity';
import { groupProPeriods } from './pro-status';

@Injectable()
export class ProService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findPlans(): Promise<{
    data: ProPlanResponseDto[];
    responseMessage: string;
  }> {
    const plans = await this.dataSource.manager.find(ProPlan, {
      where: { isOffered: true },
      order: { displayOrder: 'ASC', code: 'ASC' },
    });
    return {
      data: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        duration_months: plan.durationMonths,
        price: Number(plan.price),
      })),
      responseMessage: 'Get Pro plans success',
    };
  }

  async findSubscription(
    userId: string,
  ): Promise<{ data: ProSubscriptionResponseDto; responseMessage: string }> {
    const merchant = await this.dataSource.manager.findOne(Merchant, {
      where: { userId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const periods = await this.dataSource.manager.find(MerchantProPeriod, {
      where: { merchantId: merchant.id },
    });
    const groups = groupProPeriods(periods, new Date());
    return {
      data: {
        is_pro: groups.isPro,
        pro_until: groups.proUntil,
        current: groups.current && toPeriodResponse(groups.current),
        upcoming: groups.upcoming.map(toPeriodResponse),
        history: groups.history.map(toPeriodResponse),
      },
      responseMessage: 'Get Pro subscription success',
    };
  }
}

function toPeriodResponse(period: MerchantProPeriod): ProPeriodResponseDto {
  return {
    id: period.id,
    plan_name: period.planName,
    duration_months: period.durationMonths,
    price: period.price === null ? null : Number(period.price),
    starts_at: period.startsAt,
    ends_at: period.endsAt,
    source: period.source,
    status: period.status,
  };
}
