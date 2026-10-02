import { RequiredText } from '~/common/decorator/input.decorator';

export class UpdateCurrentUserBodyDto {
  @RequiredText({ max: 120, example: 'Jane Doe' })
  name: string;
}
