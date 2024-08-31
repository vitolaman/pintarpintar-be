import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { WeeklyPredictionLeaderboard } from '../leaderboard/entities/weekly-prediction-leaderboard.entity';
import { Repository } from 'typeorm';
import { MonthlyReferralLeaderboard } from '../leaderboard/entities/monthly-referral-leaderboard.entity';
import { YearlyLeaderboard } from '../leaderboard/entities/yearly-prediction-leaderboard.entity';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { matchStatus, sportList } from '../../constant/cron-job.constants';
import { Predictions } from '../prediction/entities/prediction.entity';

@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);

  constructor(
    @InjectRepository(WeeklyPredictionLeaderboard)
    private readonly weeklyPredictionLeaderboard: Repository<WeeklyPredictionLeaderboard>,
    @InjectRepository(MonthlyReferralLeaderboard)
    private readonly monthlyReferralLeaderboard: Repository<MonthlyReferralLeaderboard>,
    @InjectRepository(YearlyLeaderboard)
    private readonly yearlyLeaderboard: Repository<YearlyLeaderboard>,
    @InjectRepository(Predictions)
    private readonly predictionsRepo: Repository<Predictions>,
    private configService: ConfigService,
    private readonly httpService: HttpService,
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
