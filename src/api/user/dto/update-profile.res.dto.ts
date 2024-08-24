import { ResponseDto } from '~/common/dto/response.dto-default';
import { User } from '../entities/user.entity';

export class UpdateProfileResDto extends ResponseDto<User> {}
