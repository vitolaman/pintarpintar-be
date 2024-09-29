import { ResponseDto } from '~/common/dto/response.dto-default';
import { Admin } from '../entities/admin.entity';

export class AdminFindOneUserResDto extends ResponseDto<Admin> {
  constructor(partial: Partial<ResponseDto<Admin>>) {
    partial.data = new Admin(partial.data);

    super(partial);
  }

  data: Admin;
}
