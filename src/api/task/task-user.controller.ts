import { Controller, Get, Post, Body, Query, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { TaskUserService } from './task-user.service';
import { FindOneTaskUserDto } from './dto/find-one-task-user.dto';
import { VerifyTaskDto } from './dto/verify-task.dto';
import { Response } from 'express';

@Controller('task')
@ApiBearerAuth()
@ApiTags('Task')
export class TaskUserController {
  constructor(private readonly taskUserService: TaskUserService) {}

  @Get('/list')
  @ApiOperation({ summary: 'Get List Task User' })
  @ApiResponse({
    status: 200,
    description:
      'Success || taskType: 1: Watch Ads; 2: Follow Twitter; 3: Like X; 4: Retweet X;',
    schema: {
      example: {
        data: [
          {
            taskId: '44d7abd5-8337-4eb6-b5ce-40ee8dc0041e',
            taskName: 'Watch Ads',
            taskUrl: 'test',
            taskType: '1',
            token: 1,
            createdAt: '2024-08-30T23:40:11.767Z',
            is_completed: false,
          },
          {
            taskId: 'ceba22ff-afd5-442a-ba78-a476379b96a8',
            taskName: 'Follow Our Twitter',
            taskUrl: 'https://x.com/somethingord',
            taskType: '2',
            token: 2,
            createdAt: '2024-08-31T00:19:44.353Z',
            is_completed: true,
          },
          {
            taskId: '738b2732-8760-483a-a762-511bd5bcd620',
            taskName: 'Retweet Our Twitter Post',
            taskUrl: 'https://x.com/andricuanterus/status/1829722970253582344',
            taskType: '4',
            token: 3,
            createdAt: '2024-08-31T07:35:05.885Z',
            is_completed: false,
          },
          {
            taskId: '7ea4d6d9-e6f5-4014-a6d0-0d41b2badd35',
            taskName: 'Like Our Twitter Post',
            taskUrl: 'https://x.com/andricuanterus/status/1829722970253582344',
            taskType: '3',
            token: 4,
            createdAt: '2024-08-31T07:40:11.767Z',
            is_completed: false,
          },
        ],
        meta: {
          page: 1,
          per_page: 10,
          total: 4,
          total_page: 1,
        },
        responseMessage: 'Get task list for user success',
      },
    },
  })
  findAll(@Req() req, @Query() query: RequestPaginatedQueryDto) {
    return this.taskUserService.findAll(req.user.id, query);
  }

  @Get('/detail')
  @ApiOperation({ summary: 'Get Detail Task User' })
  @ApiResponse({
    status: 200,
    description:
      'Success || taskType: 1: Watch Ads; 2: Follow Twitter; 3: Like X; 4: Retweet X;',
    schema: {
      example: {
        data: {
          taskId: '44d7abd5-8337-4eb6-b5ce-40ee8dc0041e',
          taskName: 'Watch Ads',
          taskUrl: 'test',
          taskType: '1',
          token: 1,
          createdAt: '2024-08-30T23:40:11.767Z',
          is_completed: false,
        },
        responseMessage: 'Get task detail for user success',
      },
    },
  })
  findOne(@Req() req, @Query() query: FindOneTaskUserDto) {
    return this.taskUserService.findOne(req.user.id, query);
  }

  @Post('/verify')
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Successful Finish Task!',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found',
    schema: {
      example: {
        responseMessage: ['Task Not Found'],
        error: 'NOT_FOUND',
        statusCode: 404,
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    schema: {
      example: {
        responseMessage: ['Max Task Attemp Reach, Cannot finish any more task'],
        error: 'FORBIDDEN',
        statusCode: 403,
      },
    },
  })
  create(@Req() req, @Body() body: VerifyTaskDto, @Res() res: Response) {
    return this.taskUserService.verify(req.user.id, body, res);
  }
}
