import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { matchStatus, sportList } from '../../constant/cron-job.constants';
import { Predictions } from '../prediction/entities/prediction.entity';
import { WeeklyLeaderboardCategory } from '../leaderboard/entities/weekly-leaderboard-category.entity';
import { MonthlyLeaderboardCategory } from '../leaderboard/entities/monthly-leaderboard-category.entity';
import { YearlyLeaderboardCategory } from '../leaderboard/entities/yearly-leaderboard-category.entity';
import {
  getCurrentMonthEndDatetime,
  getCurrentMonthStartDatetime,
  getCurrentTuesdayStartDatetime,
  getCurrentYearEndDatetime,
  getCurrentYearStartDatetime,
  getNextMondayEndDatetime,
} from '~/common/util/date';
import { User } from '../user/entities/user.entity';
import { WeeklyPredictionLeaderboard } from '../leaderboard/entities/weekly-prediction-leaderboard.entity';

@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);

  constructor(
    @InjectRepository(WeeklyLeaderboardCategory)
    private readonly weeklyLeaderboardCategory: Repository<WeeklyLeaderboardCategory>,
    @InjectRepository(MonthlyLeaderboardCategory)
    private readonly monthlyLeaderboardCategory: Repository<MonthlyLeaderboardCategory>,
    @InjectRepository(YearlyLeaderboardCategory)
    private readonly yearlyLeaderboardCategory: Repository<YearlyLeaderboardCategory>,
    @InjectRepository(Predictions)
    private readonly predictionsRepo: Repository<Predictions>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WeeklyPredictionLeaderboard)
    private readonly weeklyLeaderboardRepo: Repository<WeeklyPredictionLeaderboard>,
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  @Cron('0 0 * * 2', {
    timeZone: 'UTC',
  }) // Cron expression for every Tuesday at midnight
  async createWeeklyPredictionCategory() {
    const queryRunner =
      this.weeklyLeaderboardCategory.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await queryRunner.manager
        .getRepository(WeeklyLeaderboardCategory)
        .createQueryBuilder('wlc')
        .orderBy('wlc.counter', 'DESC')
        .getOne();

      console.log('Query result:', result);

      const nextCounter = result ? (result.counter as number) + 1 : 1;
      const categoryName = `Week ${nextCounter}`;

      await queryRunner.manager.save(
        this.weeklyLeaderboardCategory.create({
          counter: nextCounter,
          name: categoryName,
          fromDate: getCurrentTuesdayStartDatetime(),
          toDate: getNextMondayEndDatetime(),
        }),
      );

      await queryRunner.commitTransaction();
      this.logger.log('Created Weekly Category.');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error clearing the table:', error);
    } finally {
      await queryRunner.release();
    }
  }

  @Cron('0 0 1 * *', {
    timeZone: 'UTC',
  }) // Monthly: First day of every month at midnight
  async createMonthlyPredictionCategory() {
    const queryRunner =
      this.monthlyLeaderboardCategory.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await queryRunner.manager
        .getRepository(MonthlyLeaderboardCategory)
        .createQueryBuilder('mlc')
        .orderBy('mlc.counter', 'DESC')
        .getOne();

      const nextCounter = result ? (result.counter as number) + 1 : 1;
      const categoryName = `Month ${nextCounter}`;

      await queryRunner.manager.save(
        this.monthlyLeaderboardCategory.create({
          counter: nextCounter,
          name: categoryName,
          fromDate: getCurrentMonthStartDatetime(),
          toDate: getCurrentMonthEndDatetime(),
        }),
      );

      await queryRunner.commitTransaction();
      this.logger.log('Created Monthly Category.');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating monthly category:', error);
    } finally {
      await queryRunner.release();
    }
  }

  @Cron('0 0 1 1 *', {
    timeZone: 'UTC',
  }) // Cron expression for January 1st at midnight
  async createYearlyPredictionCategory() {
    const queryRunner =
      this.yearlyLeaderboardCategory.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the latest counter value
      const result = await queryRunner.manager
        .getRepository(YearlyLeaderboardCategory)
        .createQueryBuilder('ylc')
        .orderBy('ylc.counter', 'DESC')
        .getOne();

      const nextCounter = result ? (result.counter as number) + 1 : 1;
      const categoryName = `Year ${nextCounter}`;

      await queryRunner.manager.save(
        this.yearlyLeaderboardCategory.create({
          counter: nextCounter,
          name: categoryName,
          fromDate: getCurrentYearStartDatetime(),
          toDate: getCurrentYearEndDatetime(),
        }),
      );

      await queryRunner.commitTransaction();
      this.logger.log('Created Yearly Category.');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating yearly category:', error);
    } finally {
      await queryRunner.release();
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'UTC',
  })
  async verifyPredictSoccer() {
    await this.verifyPredictSport(
      sportList.SOCCER,
      'https://apiv2.allsportsapi.com/football/',
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'UTC',
  })
  async verifyPredictBasketball() {
    await this.verifyPredictSport(
      sportList.BASKETBALL,
      'https://apiv2.allsportsapi.com/basketball/',
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'UTC',
  })
  async verifyPredictCricket() {
    const sport = sportList.CRICKET;
    const apiUrl = 'https://apiv2.allsportsapi.com/cricket/';
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

      const todayString = this.formatDate(yesterday);
      const yesterdayString = this.formatDate(dayBeforeYesterday);

      const params = {
        met: 'Fixtures',
        APIkey: this.configService.get<string>('API_KEY'),
        from: yesterdayString,
        to: todayString,
      };

      const response = await firstValueFrom(
        this.httpService.get(apiUrl, { params }).pipe(
          catchError((error) => {
            this.logger.error('Error during API call:', error.message);
            throw error;
          }),
        ),
      );

      const results = response.data.result;
      if (!results || results.length === 0) {
        return; // No results, nothing to process
      }

      for (const data of results) {
        const {
          event_status: eventStatus,
          event_home_final_result: homeResult,
          event_away_final_result: awayResult,
          event_status_info: statusInfo,
          event_home_team,
          event_away_team,
        } = data;

        if (eventStatus === matchStatus.FINISHED) {
          const result = this.determineCricketMatchOutcome(
            event_home_team,
            event_away_team,
            homeResult,
            awayResult,
            statusInfo,
          );

          const predicts = await this.predictionsRepo.find({
            where: {
              matchId: data.event_key,
              matchStatus: 0,
              sport,
            },
          });

          for (const predict of predicts) {
            predict.matchStatus = result === predict.prediction ? 1 : -1;
            if (predict.matchStatus === 1) {
              await this.weeklyLeaderboardRepo.increment(
                { id: predict.userId },
                'sum_point',
                1,
              );
            }
          }
          await this.updateMatchStatuses(predicts);
        } else if (eventStatus === matchStatus.ABANDONED) {
          const predicts = await this.predictionsRepo.find({
            where: {
              matchId: data.event_key,
              matchStatus: 0,
              sport,
            },
          });

          for (const predict of predicts) {
            predict.matchStatus = -2;
          }
          await this.updateMatchStatuses(predicts);
        }
      }
    } catch (error) {
      console.error('Error during verification process:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'UTC',
  })
  async verifyPredictTennis() {
    const sport = sportList.TENNIS;
    const apiUrl = 'https://apiv2.allsportsapi.com/tennis/';
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

      const todayString = this.formatDate(yesterday);
      const yesterdayString = this.formatDate(dayBeforeYesterday);

      const params = {
        met: 'Fixtures',
        APIkey: this.configService.get<string>('API_KEY'),
        from: yesterdayString,
        to: todayString,
      };

      const response = await firstValueFrom(
        this.httpService.get(apiUrl, { params }).pipe(
          catchError((error) => {
            this.logger.error('Error during API call:', error.message);
            throw error;
          }),
        ),
      );

      const results = response.data.result;
      if (!results || results.length === 0) {
        return; // No results, nothing to process
      }

      for (const data of results) {
        const { event_status: eventStatus, event_winner: eventWinner } = data;

        if (
          eventStatus === matchStatus.FINISHED ||
          eventStatus === matchStatus.WO ||
          eventStatus === matchStatus.RETIRED
        ) {
          const result = this.determineTennisMatchOutcome(eventWinner);

          const predicts = await this.predictionsRepo.find({
            where: {
              matchId: data.event_key,
              matchStatus: 0,
              sport,
            },
          });

          for (const predict of predicts) {
            predict.matchStatus = result === predict.prediction ? 1 : -1;
            if (predict.matchStatus === 1) {
              await this.weeklyLeaderboardRepo.increment(
                { id: predict.userId },
                'sum_point',
                1,
              );
            }
          }
          await this.updateMatchStatuses(predicts);
        } else if (eventStatus === matchStatus.CANCELLED) {
          const predicts = await this.predictionsRepo.find({
            where: {
              matchId: data.event_key,
              matchStatus: 0,
              sport,
            },
          });

          for (const predict of predicts) {
            predict.matchStatus = -2;
          }
          await this.updateMatchStatuses(predicts);
        }
      }
    } catch (error) {
      console.error('Error during verification process:', error);
    }
  }

  async verifyPredictSport(sport: string, apiUrl: string) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

      const todayString = this.formatDate(yesterday);
      const yesterdayString = this.formatDate(dayBeforeYesterday);

      const params = {
        met: 'Fixtures',
        APIkey: this.configService.get<string>('API_KEY'),
        from: yesterdayString,
        to: todayString,
      };

      const response = await firstValueFrom(
        this.httpService.get(apiUrl, { params }).pipe(
          catchError((error) => {
            this.logger.error('Error during API call:', error.message);
            throw error;
          }),
        ),
      );

      const results = response.data.result;
      if (!results || results.length === 0) {
        return; // No results, nothing to process
      }

      for (const data of results) {
        const { event_status: eventStatus, event_final_result: eventResult } =
          data;

        if (
          eventStatus === matchStatus.FINISHED ||
          eventStatus === matchStatus.PENALTY ||
          eventStatus === matchStatus.OVERTIME
        ) {
          const [homeTeamScore, awayTeamScore] =
            eventStatus === matchStatus.FINISHED ||
            eventStatus === matchStatus.OVERTIME
              ? eventResult
                  .split('-')
                  .map((score: string) => parseInt(score.trim(), 10))
              : data?.event_penalty_result
                  .split('-')
                  .map((score: string) => parseInt(score.trim(), 10));

          const result = this.determineMatchOutcome(
            homeTeamScore,
            awayTeamScore,
          );

          const predicts = await this.predictionsRepo.find({
            where: {
              matchId: data.event_key,
              matchStatus: 0,
              sport,
            },
          });

          for (const predict of predicts) {
            predict.matchStatus = result === predict.prediction ? 1 : -1;
            if (predict.matchStatus === 1) {
              await this.weeklyLeaderboardRepo.increment(
                { id: predict.userId },
                'sum_point',
                1,
              );
            }
          }
          await this.updateMatchStatuses(predicts);
        } else if (eventStatus === matchStatus.CANCELLED) {
          const predicts = await this.predictionsRepo.find({
            where: {
              matchId: data.event_key,
              matchStatus: 0,
              sport,
            },
          });

          for (const predict of predicts) {
            predict.matchStatus = -2;
          }
          await this.updateMatchStatuses(predicts);
        }
      }
    } catch (error) {
      console.error('Error during verification process:', error);
    }
  }

  private async updateMatchStatuses(matches: Predictions[]) {
    await Promise.all(
      matches.map(async (match) => {
        // update data with batch (100 data per iteration) to minimize error
        await this.predictionsRepo.save(match, { chunk: 100 });
      }),
    );
  }

  determineMatchOutcome(homeTeamScore: number, awayTeamScore: number): number {
    if (homeTeamScore > awayTeamScore) {
      return 1; // Home team wins
    } else if (homeTeamScore < awayTeamScore) {
      return 2; // Home team loses
    } else {
      return 3; // Draw
    }
  }

  determineTennisMatchOutcome(winnerInfo: string): number {
    if (winnerInfo.toLowerCase().includes('first')) {
      return 1; // First player wins
    } else if (winnerInfo.toLowerCase().includes('second')) {
      return 2; // Second player wins
    } else {
      return -1; // Undefined or error state
    }
  }

  private determineCricketMatchOutcome(
    homeTeam: string,
    awayTeam: string,
    homeScore: string,
    awayScore: string,
    statusInfo: string,
  ): number {
    const homeRuns = parseInt(homeScore.split('/')[0]);
    const awayRuns = parseInt(awayScore.split('/')[0]);

    // Split the team names into arrays of words
    const homeTeamWords = homeTeam.split(' ');
    const awayTeamWords = awayTeam.split(' ');

    // Check if any word from the home team name is included in the statusInfo
    const homeTeamWins = homeTeamWords.some((word) =>
      statusInfo.includes(word),
    );

    // Check if any word from the away team name is included in the statusInfo
    const awayTeamWins = awayTeamWords.some((word) =>
      statusInfo.includes(word),
    );

    if (homeTeamWins) {
      return 1; // Home team wins
    } else if (awayTeamWins) {
      return 2; // Away team wins
    } else if (
      statusInfo.toLowerCase().includes('drawn') ||
      homeRuns === awayRuns
    ) {
      return 3; // Draw
    }

    // Fallback to comparing scores directly if statusInfo is unclear
    if (homeRuns > awayRuns) {
      return 1; // Home team wins
    } else if (awayRuns > homeRuns) {
      return 2; // Away team wins
    } else {
      return 3; // Draw or tie
    }
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
