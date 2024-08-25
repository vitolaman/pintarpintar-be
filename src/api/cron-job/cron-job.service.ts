import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { WeeklyPredictionLeaderboard } from '../leaderboard/entities/weekly-prediction-leaderboard.entity';
import { Repository } from 'typeorm';
import { MonthlyReferralLeaderboard } from '../leaderboard/entities/monthly-referral-leaderboard.entity';
import { YearlyLeaderboard } from '../leaderboard/entities/yearly-prediction-leaderboard.entity';

@Injectable()
export class CronJobService {
  constructor(
    @InjectRepository(WeeklyPredictionLeaderboard)
    private readonly weeklyPredictionLeaderboard: Repository<WeeklyPredictionLeaderboard>,
    @InjectRepository(MonthlyReferralLeaderboard)
    private readonly monthlyReferralLeaderboard: Repository<MonthlyReferralLeaderboard>,
    @InjectRepository(YearlyLeaderboard)
    private readonly yearlyLeaderboard: Repository<YearlyLeaderboard>,
  ) {}

  @Cron('0 0 * * 2', {
    timeZone: 'UTC',
  }) // Cron expression for every Tuesday at midnight
  async wipeWeeklyPredictionLeaderboard() {
    try {
      await this.weeklyPredictionLeaderboard.clear();
      console.log('Weekly prediction leaderboard table has been cleared.');
    } catch (error) {
      console.error('Error clearing the table:', error);
    }
  }

  @Cron('0 0 1 * *', {
    timeZone: 'UTC',
  }) // Monthly: First day of every month at midnight
  async wipeMonthlyPredictionLeaderboard() {
    try {
      await this.monthlyReferralLeaderboard.clear();
      console.log('Monthly prediction leaderboard table has been cleared.');
    } catch (error) {
      console.error('Error clearing the table:', error);
    }
  }

  @Cron('0 0 1 1 *', {
    timeZone: 'UTC',
  }) // Yearly: January 1st at midnight
  async wipeYearlyPredictionLeaderboard() {
    try {
      await this.yearlyLeaderboard.clear();
      console.log('Yearly prediction leaderboard table has been cleared.');
    } catch (error) {
      console.error('Error clearing the table:', error);
    }
  }
}
