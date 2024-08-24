import { ResponsePaginatedDto } from '~/common/dto/response-paginated.dto-default';
import { Task } from '../entities/task.entity';

export class FindAllTaskResDto extends ResponsePaginatedDto<Task> {}
