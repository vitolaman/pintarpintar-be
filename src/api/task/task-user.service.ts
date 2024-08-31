import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Task } from './entities/task.entity';
import { TaskHistory } from './entities/task-histories.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';
import {
  FindOneTaskUserDto,
  FindOneTaskUserResDto,
} from './dto/find-one-task-user.dto';
import * as moment from 'moment';
import { VerifyTaskDto } from './dto/verify-task.dto';
import { TaskRepeatableTypeEnum, TaskTypeEnum } from './task.enum';
import { User } from '../user/entities/user.entity';
import { HttpService } from '~/common/util/http.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { FindAllTaskUserResDto } from './dto/find-all-task-user.res.dto';

@Injectable()
export class TaskUserService {
  private twitterApiUrl: string;
  private twitterApiKey: string;

  constructor(
    @InjectRepository(Task)
    private masterTaskRepo: Repository<Task>,
    @InjectRepository(TaskHistory)
    private taskHistoryRepo: Repository<TaskHistory>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private httpService: HttpService,
    private configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.twitterApiUrl = 'https://twitter-api45.p.rapidapi.com/';
    this.twitterApiKey = this.configService.get<string>(
      'TWITTER_RAPIDAPI.apiKey',
    );
  }

  async findOne(userId: string, query: FindOneTaskUserDto) {
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        't.id as "taskId"',
        't.task_name as "taskName"',
        't.url as "taskUrl"',
        't.type as "taskType"',
        't.token as "token"',
        't.created_at as "createdAt"',
      ])
      .from(Task, 't')
      .leftJoin(
        TaskHistory,
        'th',
        't.id = th.task_id AND th.user_id = :userId',
        { userId },
      )
      .where('t.id = :taskId', { taskId: query.masterTaskId })
      .where('t.deleted_at IS NULL')
      .groupBy('t.id')
      .addSelect(
        `
        CASE
          WHEN t."isRepeatable" = false AND COUNT(th.id) > 0 THEN true
          WHEN t."isRepeatable" = true AND t."isUnlimited" = true THEN false
          WHEN t."isRepeatable" = true AND t."isUnlimited" = false AND t."repeatableType" = 0 AND COUNT(th.id) >= t.max_repeat THEN true
          WHEN t."isRepeatable" = true AND t."isUnlimited" = false AND t."repeatableType" = 1 THEN 
            CASE 
              WHEN MAX(th.created_at)::date = NOW()::date AND COUNT(th.id) >= t.max_repeat THEN true
              ELSE false
            END
          ELSE false
        END
      `,
        'is_completed',
      );

    const task = await queryBuilder.getRawOne();

    return new FindOneTaskUserResDto({
      data: task,
      responseMessage: 'Get task detail for user success',
    });
  }

  async findAll(
    userId: string,
    { limit, page }: RequestPaginatedQueryWithSearchDto,
  ): Promise<FindAllTaskUserResDto> {
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        't.id as "taskId"',
        't.task_name as "taskName"',
        't.url as "taskUrl"',
        't.type as "taskType"',
        't.token as "token"',
        't.created_at as "createdAt"',
      ])
      .from(Task, 't')
      .leftJoin(
        TaskHistory,
        'th',
        't.id = th.task_id AND th.user_id = :userId',
        { userId },
      )
      .where('t.deleted_at IS NULL')
      .groupBy('t.id')
      .orderBy('t.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .addSelect(
        `
        CASE
          WHEN t."isRepeatable" = false AND COUNT(th.id) > 0 THEN true
          WHEN t."isRepeatable" = true AND t."isUnlimited" = true THEN false
          WHEN t."isRepeatable" = true AND t."isUnlimited" = false AND t."repeatableType" = 0 AND COUNT(th.id) >= t.max_repeat THEN true
          WHEN t."isRepeatable" = true AND t."isUnlimited" = false AND t."repeatableType" = 1 THEN 
            CASE 
              WHEN MAX(th.created_at)::date = NOW()::date AND COUNT(th.id) >= t.max_repeat THEN true
              ELSE false
            END
          ELSE false
        END
      `,
        'is_completed',
      );

    const tasks = await queryBuilder.getRawMany();

    const totalQuery = this.dataSource
      .createQueryBuilder()
      .select('COUNT(t.id)', 'total')
      .from(Task, 't')
      .where('t.deleted_at IS NULL');

    const totalResult = await totalQuery.getRawOne();
    const total = Number(totalResult?.total || 0);

    return new FindAllTaskUserResDto({
      data: tasks,
      responseMessage: 'Get task list for user success',
      meta: {
        page,
        per_page: limit,
        total,
      },
    });
  }

  async verify(userId: string, body: VerifyTaskDto, res: Response) {
    const { masterTaskId } = body;

    const masterTask = await this._validateMasterTask(masterTaskId);

    const user = await this.userRepo.findOneBy({
      id: userId,
    });

    await this._validateTaskHistory(masterTask, userId);

    switch (masterTask.type) {
      case TaskTypeEnum.WATCH_ADS:
        break;
      case TaskTypeEnum.FOLLOW_TWITTER:
        await this._validateFollowTwitter(masterTask, user);
        break;
      case TaskTypeEnum.LIKE_TWITTER:
        await this._validateLikeTwitter(masterTask, user);
        break;
      case TaskTypeEnum.RETWEET_TWITTER:
        await this._validateRetweetTwitter(masterTask, user);
        break;
      default:
        throw new InternalServerErrorException();
    }

    await this._updatePredictToken(masterTask, user);
    await this._insertTaskHistory(masterTask, userId);

    return res.status(HttpStatus.OK).json({
      responseMessage: `Successful Finish Task!`,
    });
  }

  private async _validateMasterTask(masterTaskId: string) {
    const masterTask = await this.masterTaskRepo.findOneBy({
      id: masterTaskId,
    });

    if (!masterTask) {
      throw new NotFoundException('Task Not Found');
    }

    return masterTask;
  }

  private async _validateTaskHistory(masterTask: Task, userId: string) {
    let taskHistory;
    if (masterTask.isRepeatable == true) {
      if (masterTask.isUnlimited != true) {
        if (masterTask.repeatableType == TaskRepeatableTypeEnum.NONE) {
          taskHistory = (await this._findAllTaskHistory(
            masterTask.id,
            userId,
          )) as TaskHistory[];
        } else if (masterTask.repeatableType == TaskRepeatableTypeEnum.DAILY) {
          taskHistory = (await this._findAllTodayTaskHistory(
            masterTask.id,
            userId,
          )) as TaskHistory[];
        }
        if (taskHistory.length >= masterTask.maxRepeat) {
          throw new ForbiddenException(
            'Max Task Attemp Reach, Cannot finish any more task',
          );
        }
      }
    } else {
      taskHistory = await this._findOneTaskHistory(masterTask.id, userId);
      if (taskHistory) {
        throw new ForbiddenException(
          'Max Task Attemp Reach, Cannot finish any more task',
        );
      }
    }
  }

  private async _findOneTaskHistory(masterTaskId: string, userId: string) {
    const taskHistory = await this.taskHistoryRepo.findOneBy({
      taskId: masterTaskId,
      userId,
    });

    return taskHistory;
  }

  private async _findAllTaskHistory(
    masterTaskId: string,
    userId: string,
  ): Promise<TaskHistory[]> {
    const taskHistories = await this.taskHistoryRepo.find({
      where: {
        taskId: masterTaskId,
        userId,
      },
    });

    return taskHistories;
  }

  private async _findAllTodayTaskHistory(
    masterTaskId: string,
    userId: string,
  ): Promise<TaskHistory[]> {
    const startOfDayUTC = moment.utc().startOf('day').toDate();
    const endOfDayUTC = moment.utc().endOf('day').toDate();

    const taskHistories = await this.taskHistoryRepo.find({
      where: {
        taskId: masterTaskId,
        userId,
        created_at: Between(startOfDayUTC, endOfDayUTC),
      },
    });

    return taskHistories;
  }

  private async _updatePredictToken(masterTask: Task, user: User) {
    user.predictToken = user.predictToken + masterTask.token;

    await this.userRepo.save(user);
  }

  private async _insertTaskHistory(masterTask: Task, userId: string) {
    const data = {
      userId,
      taskId: masterTask.id,
    } as TaskHistory;

    const taskHistory = await this.taskHistoryRepo.save(
      this.taskHistoryRepo.create(data),
    );

    return taskHistory;
  }

  private _extractIdFromUrl(url: string) {
    const parts = url.split('/');
    const id = parts[parts.length - 1];
    return id;
  }

  private async _validateUserTwitterUsername(user: User) {
    if (!user.twitterUsername) {
      throw new NotFoundException('User Twitter Username not found');
    }
  }

  private _getTwitterApiHeader() {
    const headers = {
      'x-rapidapi-host': 'twitter-api45.p.rapidapi.com',
      'x-rapidapi-key': this.twitterApiKey,
    };

    return headers;
  }

  private async _validateFollowTwitter(masterTask: Task, user: User) {
    await this._validateUserTwitterUsername(user);

    const pathUrl = this.twitterApiUrl + 'checkfollow.php';
    const headers = this._getTwitterApiHeader();
    const queryParams = {
      user: user.twitterUsername,
      follows: this._extractIdFromUrl(masterTask.url),
    };

    const result = await this.httpService.get(pathUrl, queryParams, headers);

    if (result.is_follow != true) {
      throw new ForbiddenException(
        'You need to follow the specified Twitter account to complete this task.',
      );
    }
  }

  private async _validateRetweetTwitter(masterTask: Task, user: User) {
    await this._validateUserTwitterUsername(user);

    const pathUrl = this.twitterApiUrl + 'checkretweet.php';
    const headers = this._getTwitterApiHeader();
    const queryParams = {
      screenname: user.twitterUsername,
      tweet_id: this._extractIdFromUrl(masterTask.url),
    };

    const result = await this.httpService.get(pathUrl, queryParams, headers);

    if (result.is_retweeted != true) {
      throw new ForbiddenException(
        'You need to retweet the specified Twitter post to complete this task.',
      );
    }
  }

  private async _validateLikeTwitter(masterTask: Task, user: User) {
    await this._validateUserTwitterUsername(user);

    const pathUrl = this.twitterApiUrl + 'checklike.php';
    const headers = this._getTwitterApiHeader();
    const queryParams = {
      screenname: user.twitterUsername,
      tweet_id: this._extractIdFromUrl(masterTask.url),
    };

    const result = await this.httpService.get(pathUrl, queryParams, headers);

    if (result.is_liked != true) {
      throw new ForbiddenException(
        'You need to like the specified Twitter post to complete this task.',
      );
    }
  }
}
