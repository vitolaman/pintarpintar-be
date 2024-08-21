import { ResponsePaginatedDto } from '~/common/dto/response-paginated.dto-default';
import { User } from '../entities/user.entity';

export class FindAllUserResDto extends ResponsePaginatedDto<User> {}
