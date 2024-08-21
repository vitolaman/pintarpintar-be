import { ResponseDto } from '~/common/dto/response.dto-default';
import { Token } from './token.dto';

export class SignInResDto extends ResponseDto<Token> {
  data: Token;
}
