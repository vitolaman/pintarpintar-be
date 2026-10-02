import { ResponseMetaDto } from './response-meta.dto';

export class ResponsePaginatedDto<T> {
  data: T[];
  responseMessage: string;
  meta: ResponseMetaDto;
}
