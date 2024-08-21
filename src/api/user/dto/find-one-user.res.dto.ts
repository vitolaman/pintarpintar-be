import { ResponseDto } from '~/common/dto/response.dto-default';
import { User } from '../entities/user.entity';

export class FindOneUserResDto extends ResponseDto<User> {
  constructor(partial: Partial<ResponseDto<User>>) {
    partial.data = new User(partial.data);

    super(partial);
  }

  data: User;
}
