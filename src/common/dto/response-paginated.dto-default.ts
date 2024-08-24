import { ResponseMetaDto } from './response-meta.dto';

export class ResponsePaginatedDto<T> {
  data: T[];
  responseMessage: string;
  meta: ResponseMetaDto;

  constructor(partial: Partial<ResponsePaginatedDto<T>>) {
    const { data, meta, responseMessage } = partial;

    Object.assign(this, {
      data,
      meta: new ResponseMetaDto(meta),
      responseMessage,
    });
  }
}
