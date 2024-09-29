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
  Delete,
  UseGuards,
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
import {
  AdminJwtGuard,
  UseAdminJwtGuard,
} from '~/common/guard/admin-jwt.guard';

@Controller('task/master')
@ApiBearerAuth()
@ApiTags('Master Task')
@UseGuards(AdminJwtGuard)
@UseAdminJwtGuard()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @DefaultResponse(Task, 'Create task success', HttpStatus.CREATED, [
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

  @Get(':id')
  @DefaultResponse(Task, 'Get task success', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
  ])
  async findOne(@Param('id') id: string) {
    return this.taskService.findOne(id);
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

  @DefaultResponse(Task, 'Delete task success', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
  ])
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.taskService.delete(id);
  }
}
