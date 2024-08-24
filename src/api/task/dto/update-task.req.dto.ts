import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.req.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
