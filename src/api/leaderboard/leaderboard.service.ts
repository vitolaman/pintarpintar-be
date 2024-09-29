import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { MonthlyReferralLeaderboard } from './entities/monthly-referral-leaderboard.entity';
import { Repository } from 'typeorm';
import { WeeklyPredictionLeaderboard } from './entities/weekly-prediction-leaderboard.entity';
import { YearlyLeaderboard } from './entities/yearly-prediction-leaderboard.entity';
import { WeeklyLeaderboardCategory } from './entities/weekly-leaderboard-category.entity';
import { MonthlyLeaderboardCategory } from './entities/monthly-leaderboard-category.entity';
import { YearlyLeaderboardCategory } from './entities/yearly-leaderboard-category.entity';
import { LeaderboardDto } from './dto/leaderboard.dto';
import {
  getCurrentMonthEndDatetime,
  getCurrentMonthStartDatetime,
  getCurrentTuesdayStartDatetime,
  getCurrentYearEndDatetime,
  getCurrentYearStartDatetime,
  getNextMondayEndDatetime,
} from '~/common/util/date';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(WeeklyPredictionLeaderboard)
    private readonly weeklyPredictionLeaderboardRepository: Repository<WeeklyPredictionLeaderboard>,
    @InjectRepository(MonthlyReferralLeaderboard)
    private readonly monthlyReferralLeaderboardRepository: Repository<MonthlyReferralLeaderboard>,
    @InjectRepository(YearlyLeaderboard)
    private readonly yearlyLeaderboardRepository: Repository<YearlyLeaderboard>,
    @InjectRepository(WeeklyLeaderboardCategory)
    private readonly weeklyLeaderboardCategoryRepository: Repository<WeeklyLeaderboardCategory>,
    @InjectRepository(MonthlyLeaderboardCategory)
    private readonly monthlyLeaderboardCategoryRepository: Repository<MonthlyLeaderboardCategory>,
    @InjectRepository(YearlyLeaderboardCategory)
    private readonly yearlyLeaderboardCategoryRepository: Repository<YearlyLeaderboardCategory>,
  ) {}

  async weeklyLeaderboardCategory(res: Response) {
    const category = await this.weeklyLeaderboardCategoryRepository
      .createQueryBuilder('wlc')
      .select(['wlc.id as "id"', 'wlc.name as "name"'])
      .orderBy('wlc.created_at', 'DESC')
      .getRawMany();

    return res.status(HttpStatus.OK).json({
      responseMessage: `Weekly Leaderboard Category Success`,
      data: {
        category: category || [],
      },
    });
  }

  async monthlyLeaderboardCategory(res: Response) {
    const category = await this.monthlyLeaderboardCategoryRepository
      .createQueryBuilder('mlc')
      .select(['mlc.id as "id"', 'mlc.name as "name"'])
      .orderBy('mlc.created_at', 'DESC')
      .getRawMany();

    return res.status(HttpStatus.OK).json({
      responseMessage: `Montly Leaderboard Category Success`,
      data: {
        category: category || [],
      },
    });
  }

  async yearlyLeaderboardCategory(res: Response) {
    const category = await this.yearlyLeaderboardCategoryRepository
      .createQueryBuilder('ylc')
      .select(['ylc.id as "id"', 'ylc.name as "name"'])
      .orderBy('ylc.created_at', 'DESC')
      .getRawMany();

    return res.status(HttpStatus.OK).json({
      responseMessage: `Yearly Leaderboard Category Success`,
      data: {
        category: category || [],
      },
    });
  }

  async weeklyLeaderboard(
    query: LeaderboardDto,
    userId: string,
    res: Response,
  ) {
    let additionalWhere = '';
    const parameters: any = {};

    additionalWhere =
      'AND (leaderboard.fromDate = :fromDate and leaderboard.toDate = :toDate)';
    parameters.fromDate = getCurrentTuesdayStartDatetime();
    parameters.toDate = getNextMondayEndDatetime();

    if (query.categoryId) {
      const category = await this.weeklyLeaderboardCategoryRepository
        .createQueryBuilder('wlc')
        .where('wlc.id = :id', { id: query.categoryId })
        .getOne();

      // Add additional where clause for category filter
      additionalWhere =
        'AND (leaderboard.fromDate = :fromDate and leaderboard.toDate = :toDate)';
      parameters.fromDate = category
        ? category.fromDate
        : getCurrentTuesdayStartDatetime();
      parameters.toDate = category
        ? category.toDate
        : getNextMondayEndDatetime();
    }

    // Fetch all users in the leaderboard with ranks
    const allUsers = await this.weeklyPredictionLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'leaderboard.sumPoint as "sumPoint"',
        'leaderboard.updated_at',
        'user.username',
        'RANK() OVER (ORDER BY leaderboard.sumPoint DESC, leaderboard.updated_at ASC) AS rank',
      ])
      .where(`1=1 ${additionalWhere}`, parameters)
      .orderBy('leaderboard.sumPoint', 'DESC')
      .addOrderBy('leaderboard.updated_at', 'ASC')
      .getRawMany();

    const topUsers = allUsers.slice(0, 20);

    const loggedInUser = allUsers.find((user) => user.userId === userId);

    return res.status(HttpStatus.OK).json({
      responseMessage: `Get Top Weekly Leaderboard Success`,
      data: {
        topUsers:
          topUsers.map((user) => ({
            rank: user.rank,
            userId: user.userId,
            username: user.user_username,
            sumPoint: user.sumPoint,
            updated_at: user.leaderboard_updated_at,
          })) || [],
        loggedInUser: loggedInUser
          ? {
              rank: loggedInUser.rank,
              userId: loggedInUser.userId,
              username: loggedInUser.user_username,
              sumPoint: loggedInUser.sumPoint,
              updated_at: loggedInUser.leaderboard_updated_at,
            }
          : null,
      },
    });
  }

  async monthlyLeaderboard(
    query: LeaderboardDto,
    userId: string,
    res: Response,
  ) {
    let additionalWhere = '';
    const parameters: any = {};

    additionalWhere =
      'AND (leaderboard.fromDate = :fromDate and leaderboard.toDate = :toDate)';
    parameters.fromDate = getCurrentMonthStartDatetime();
    parameters.toDate = getCurrentMonthEndDatetime();

    if (query.categoryId) {
      const category = await this.monthlyLeaderboardCategoryRepository
        .createQueryBuilder('mlc')
        .where('mlc.id = :id', { id: query.categoryId })
        .getOne();

      // Add additional where clause for category filter
      additionalWhere =
        'AND (leaderboard.fromDate = :fromDate and leaderboard.toDate = :toDate)';
      parameters.fromDate = category
        ? category.fromDate
        : getCurrentMonthStartDatetime();
      parameters.toDate = category
        ? category.toDate
        : getCurrentMonthEndDatetime();
    }

    // Fetch all users in the leaderboard with ranks
    const allUsers = await this.monthlyReferralLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'leaderboard.sumPoint as "sumPoint"',
        'leaderboard.updated_at',
        'user.username',
        'RANK() OVER (ORDER BY leaderboard.sumPoint DESC, leaderboard.updated_at ASC) AS rank',
      ])
      .where(`1=1 ${additionalWhere}`, parameters)
      .orderBy('leaderboard.sumPoint', 'DESC')
      .addOrderBy('leaderboard.updated_at', 'ASC')
      .getRawMany();

    const topUsers = allUsers.slice(0, 20);

    const loggedInUser = allUsers.find((user) => user.userId === userId);

    return res.status(HttpStatus.OK).json({
      responseMessage: `Get Top Monthly Leaderboard Success`,
      data: {
        topUsers:
          topUsers.map((user) => ({
            rank: user.rank,
            userId: user.userId,
            username: user.user_username,
            sumPoint: user.sumPoint,
            updated_at: user.leaderboard_updated_at,
          })) || [],
        loggedInUser: loggedInUser
          ? {
              rank: loggedInUser.rank,
              userId: loggedInUser.userId,
              username: loggedInUser.user_username,
              sumPoint: loggedInUser.sumPoint,
              updated_at: loggedInUser.leaderboard_updated_at,
            }
          : null,
      },
    });
  }

  async yearlyLeaderboard(
    query: LeaderboardDto,
    userId: string,
    res: Response,
  ) {
    let additionalWhere = '';
    const parameters: any = {};

    additionalWhere =
      'AND (leaderboard.fromDate = :fromDate and leaderboard.toDate = :toDate)';
    parameters.fromDate = getCurrentYearStartDatetime();
    parameters.toDate = getCurrentYearEndDatetime();

    if (query.categoryId) {
      const category = await this.weeklyLeaderboardCategoryRepository
        .createQueryBuilder('wlc')
        .where('wlc.id = :id', { id: query.categoryId })
        .getOne();

      // Add additional where clause for category filter
      additionalWhere =
        'AND (leaderboard.fromDate = :fromDate and leaderboard.toDate = :toDate)';
      parameters.fromDate = category
        ? category.fromDate
        : getCurrentYearStartDatetime();
      parameters.toDate = category
        ? category.toDate
        : getCurrentYearEndDatetime();
    }

    // Fetch all users in the leaderboard with ranks
    const allUsers = await this.yearlyLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'SUM(leaderboard.sumPoint) as "sumPoint"',
        'MAX(leaderboard.updated_at) as "updated_at"',
        'user.username',
        'RANK() OVER (ORDER BY SUM(leaderboard.sumPoint) DESC, MAX(leaderboard.updated_at) ASC) AS rank',
      ])
      .where(`1=1 ${additionalWhere}`, parameters)
      .groupBy('leaderboard.userId, user.username')
      .orderBy('SUM(leaderboard.sumPoint)', 'DESC')
      .addOrderBy('MAX(leaderboard.updated_at)', 'ASC')
      .getRawMany();

    const topUsers = allUsers.slice(0, 20);

    const loggedInUser = allUsers.find((user) => user.userId === userId);

    return res.status(HttpStatus.OK).json({
      responseMessage: `Get Top Yearly Leaderboard Success`,
      data: {
        topUsers: topUsers.map((user) => ({
          rank: user.rank,
          userId: user.userId,
          username: user.username,
          sumPoint: parseInt(user.sumPoint, 10),
          updated_at: user.updated_at,
        })),
        loggedInUser: loggedInUser
          ? {
              rank: loggedInUser.rank,
              userId: loggedInUser.userId,
              username: loggedInUser.username,
              sumPoint: parseInt(loggedInUser.sumPoint, 10),
              updated_at: loggedInUser.updated_at,
            }
          : null,
      },
    });
  }

  async updateWeeklyPredictionLeaderboard(userId: string) {
    const weeklyPrediction = await this.weeklyPredictionLeaderboardRepository
      .createQueryBuilder('wlr')
      .setLock('pessimistic_write')
      .where('wlr.user_id = :user_id', {
        user_id: userId,
        from_date: getCurrentTuesdayStartDatetime(),
        to_date: getNextMondayEndDatetime(),
      })
      .getRawOne();

    if (weeklyPrediction) {
      await this.weeklyPredictionLeaderboardRepository.increment(
        {
          userId: userId,
          fromDate: getCurrentTuesdayStartDatetime(),
          toDate: getNextMondayEndDatetime(),
        },
        'sumPoint',
        1,
      );
    } else {
      await this.weeklyPredictionLeaderboardRepository.save(
        this.weeklyPredictionLeaderboardRepository.create({
          userId: userId,
          sumPoint: 1,
          fromDate: getCurrentTuesdayStartDatetime(),
          toDate: getNextMondayEndDatetime(),
        }),
      );
    }
  }

  async updateMonthlyReferralLeaderboard(userId: string) {
    const monthly = await this.monthlyReferralLeaderboardRepository
      .createQueryBuilder('mrl')
      .setLock('pessimistic_write')
      .where('mrl.user_id = :user_id', {
        user_id: userId,
        from_date: getCurrentMonthStartDatetime(),
        to_date: getCurrentMonthEndDatetime(),
      })
      .getRawOne();

    if (monthly) {
      await this.monthlyReferralLeaderboardRepository.increment(
        {
          userId: userId,
          fromDate: getCurrentMonthStartDatetime(),
          toDate: getCurrentMonthEndDatetime(),
        },
        'sumPoint',
        1,
      );
    } else {
      await this.monthlyReferralLeaderboardRepository.save(
        this.monthlyReferralLeaderboardRepository.create({
          userId: userId,
          sumPoint: 1,
          fromDate: getCurrentMonthStartDatetime(),
          toDate: getCurrentMonthEndDatetime(),
        }),
      );
    }
  }

  async updateYearlyReferralLeaderboard(userId: string) {
    const yearly = await this.yearlyLeaderboardRepository
      .createQueryBuilder('ylr')
      .setLock('pessimistic_write')
      .where('ylr.user_id = :user_id', {
        user_id: userId,
        type: 2,
        from_date: getCurrentYearStartDatetime(),
        to_date: getCurrentYearEndDatetime(),
      })
      .getRawOne();

    if (yearly) {
      await this.yearlyLeaderboardRepository.increment(
        {
          userId: userId,
          type: 2,
          fromDate: getCurrentYearStartDatetime(),
          toDate: getCurrentYearEndDatetime(),
        },
        'sumPoint',
        1,
      );
    } else {
      await this.yearlyLeaderboardRepository.save(
        this.yearlyLeaderboardRepository.create({
          userId: userId,
          sumPoint: 1,
          type: 2,
          fromDate: getCurrentYearStartDatetime(),
          toDate: getCurrentYearEndDatetime(),
        }),
      );
    }
  }

  async updateYearlyPredictionLeaderboard(userId: string) {
    const yearly = await this.yearlyLeaderboardRepository
      .createQueryBuilder('ylr')
      .setLock('pessimistic_write')
      .where('ylr.user_id = :user_id', {
        user_id: userId,
        type: 1,
        from_date: getCurrentYearStartDatetime(),
        to_date: getCurrentYearEndDatetime(),
      })
      .getRawOne();

    if (yearly) {
      await this.yearlyLeaderboardRepository.increment(
        {
          userId: userId,
          type: 1,
          fromDate: getCurrentYearStartDatetime(),
          toDate: getCurrentYearEndDatetime(),
        },
        'sumPoint',
        1,
      );
    } else {
      await this.yearlyLeaderboardRepository.save(
        this.yearlyLeaderboardRepository.create({
          userId: userId,
          sumPoint: 1,
          type: 1,
          fromDate: getCurrentYearStartDatetime(),
          toDate: getCurrentYearEndDatetime(),
        }),
      );
    }
  }
}
