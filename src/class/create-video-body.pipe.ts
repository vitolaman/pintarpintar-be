import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_OPTIONS } from '../common/validation/validation-options';
import { CreateVideoDto, CreateVideosDto } from './dto/video.dto';

/**
 * The video create route takes one video or a `videos` list. The route's body
 * is a union, which the global pipe leaves alone, so this pipe validates it
 * against the DTO its shape selects, with the application's options: a body
 * that mixes `videos` with single-video fields is rejected as unknown fields.
 */
@Injectable()
export class CreateVideoBodyPipe implements PipeTransform {
  private readonly validation = new ValidationPipe(VALIDATION_OPTIONS);

  transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<CreateVideoDto | CreateVideosDto> {
    const metatype = isVideoList(value) ? CreateVideosDto : CreateVideoDto;
    return this.validation.transform(value, { ...metadata, metatype });
  }
}

function isVideoList(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'videos' in value;
}
