import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  BadRequestException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.req.dto';
import { UpdateTaskDto } from './dto/update-task.req.dto';
import { Task } from './entities/task.entity';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';

@Controller('task/master')
@ApiBearerAuth()
@ApiTags('Master Task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @DefaultResponse(Task, 'Create task success', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
  ])
  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.taskService.create(createTaskDto);
  }

  @Get()
  @PaginatedResponse(Task, 'Get task list success', [
    BadRequestException,
    UnauthorizedException,
  ])
  findAll(@Query() query: RequestPaginatedQueryDto) {
    return this.taskService.findAll(query);
  }

  @DefaultResponse(Task, 'Update task success', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
  ])
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.taskService.update(id, updateTaskDto);
  }
}
