import {
  ClearableText,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { MAX_DESCRIPTION_LENGTH } from './content-validation';

export class CreateChapterDto {
  @RequiredText({ max: 255 })
  title: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @NumberInput({
    presence: 'optional',
    integer: true,
    min: 0,
    description: 'Defaults to after the last chapter',
  })
  order?: number;
}
