import { ResponseDto } from '~/common/dto/response.dto-default';

export class SignInResDto extends ResponseDto<any> {
  data: {
    token: string;
  };
}
