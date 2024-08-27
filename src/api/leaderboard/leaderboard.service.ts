import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { MonthlyReferralLeaderboard } from './entities/monthly-referral-leaderboard.entity';
import { Repository } from 'typeorm';
import { WeeklyPredictionLeaderboard } from './entities/weekly-prediction-leaderboard.entity';
import { YearlyLeaderboard } from './entities/yearly-prediction-leaderboard.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(WeeklyPredictionLeaderboard)
    private readonly weeklyPredictionLeaderboardRepository: Repository<WeeklyPredictionLeaderboard>,
    @InjectRepository(MonthlyReferralLeaderboard)
    private readonly monthlyReferralLeaderboardRepository: Repository<MonthlyReferralLeaderboard>,
    @InjectRepository(YearlyLeaderboard)
    private readonly yearlyLeaderboardRepository: Repository<YearlyLeaderboard>,
  ) {}

  async weeklyLeaderboard(userId: string, res: Response) {
    const topUsers = await this.weeklyPredictionLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'leaderboard.sumPoint as "sumPoint"',
        'leaderboard.updated_at',
        'user.username',
        'RANK() OVER (ORDER BY leaderboard.sumPoint DESC, leaderboard.updated_at ASC) AS rank',
      ])
      .orderBy('leaderboard.sumPoint', 'DESC')
      .addOrderBy('leaderboard.updated_at', 'ASC')
      .limit(20)
      .getRawMany();

    const loggedInUser = await this.weeklyPredictionLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.user_id as "userId"',
        'leaderboard.sum_point as "sumPoint"',
        'leaderboard.updated_at',
        'user.username',
        'RANK() OVER (ORDER BY leaderboard.sumPoint DESC, leaderboard.updated_at ASC) AS rank',
      ])
      .where('leaderboard.userId = :userId', { userId })
      .getRawOne();

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

  async monthlyLeaderboard(userId: string, res: Response) {
    const topUsers = await this.monthlyReferralLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'leaderboard.sumPoint as "sumPoint"',
        'leaderboard.updated_at',
        'user.username',
        'RANK() OVER (ORDER BY leaderboard.sumPoint DESC, leaderboard.updated_at ASC) AS rank',
      ])
      .orderBy('leaderboard.sumPoint', 'DESC')
      .addOrderBy('leaderboard.updated_at', 'ASC')
      .limit(20)
      .getRawMany();

    const loggedInUser = await this.monthlyReferralLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.user_id as "userId"',
        'leaderboard.sum_point as "sumPoint"',
        'leaderboard.updated_at',
        'user.username',
        'RANK() OVER (ORDER BY leaderboard.sumPoint DESC, leaderboard.updated_at ASC) AS rank',
      ])
      .where('leaderboard.userId = :userId', { userId })
      .getRawOne();

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

  async yearlyLeaderboard(userId: string, res: Response) {
    const topUsers = await this.yearlyLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'SUM(leaderboard.sumPoint) as "sumPoint"',
        'MAX(leaderboard.updated_at) as "updated_at"',
        'user.username',
        'RANK() OVER (ORDER BY SUM(leaderboard.sumPoint) DESC, MAX(leaderboard.updated_at) ASC) AS rank',
      ])
      .groupBy('leaderboard.userId, user.username')
      .orderBy('SUM(leaderboard.sumPoint)', 'DESC')
      .addOrderBy('MAX(leaderboard.updated_at)', 'ASC')
      .limit(20)
      .getRawMany();

    const loggedInUser = await this.yearlyLeaderboardRepository
      .createQueryBuilder('leaderboard')
      .leftJoinAndSelect('users', 'user', 'leaderboard.userId = user.id')
      .select([
        'leaderboard.userId as "userId"',
        'SUM(leaderboard.sumPoint) as "sumPoint"',
        'MAX(leaderboard.updated_at) as "updated_at"',
        'user.username',
        'RANK() OVER (ORDER BY SUM(leaderboard.sumPoint) DESC, MAX(leaderboard.updated_at) ASC) AS rank',
      ])
      .where('leaderboard.userId = :userId', { userId })
      .groupBy('leaderboard.userId, user.username')
      .getRawOne();

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
}
