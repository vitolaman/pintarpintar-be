import { ResponseDto } from '~/common/dto/response.dto-default';
import { Task } from '../entities/task.entity';

export class FindOneTaskResDto extends ResponseDto<Task> {}
