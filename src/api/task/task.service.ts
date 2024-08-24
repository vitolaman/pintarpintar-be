import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.req.dto';
import { UpdateTaskDto } from './dto/update-task.req.dto';
import { Task } from './entities/task.entity';
import { TaskHistory } from './entities/task-histories.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskResDto } from './dto/create-task.res.dto';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';
import { FindAllTaskResDto } from './dto/find-all-task.res.dto';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private masterTaskRepo: Repository<Task>,
    @InjectRepository(TaskHistory)
    private taskHistoryRepo: Repository<TaskHistory>,
  ) {}

  async create(body: CreateTaskDto) {
    const task = await this.masterTaskRepo.save(
      this.masterTaskRepo.create(body),
    );

    return new CreateTaskResDto({
      data: task,
      responseMessage: 'Create task success',
    });
  }

  async findAll({
    limit,
    page,
  }: RequestPaginatedQueryWithSearchDto): Promise<FindAllTaskResDto> {
    const [tasks, total] = await this.masterTaskRepo.findAndCount({
      order: {
        created_at: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new FindAllTaskResDto({
      data: tasks,
      responseMessage: 'Get task list success',
      meta: {
        page,
        per_page: limit,
        total,
      },
    });
  }

  async update(id: string, body: UpdateTaskDto) {
    const { name, url, type } = body;
    const task = await this.masterTaskRepo.findOne({ where: { id } });

    if (!name && !url && !type) {
      throw new BadRequestException('Invalid request body');
    }

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    Object.assign(task, body);

    const newTask = await this.masterTaskRepo.save(task);

    return new CreateTaskResDto({
      data: newTask,
      responseMessage: 'Update task success',
    });
  }
}
