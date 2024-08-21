import { ResponseDto } from '~/common/dto/response.dto-default';

class Message {
  message: string;
}

export class SignUpResDto extends ResponseDto<Message> {}
