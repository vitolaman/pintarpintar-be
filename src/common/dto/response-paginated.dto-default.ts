import { ResponseMetaDto } from './response-meta.dto';

export class ResponsePaginatedDto<T> {
  data: T[];

  meta: ResponseMetaDto;

  constructor(partial: Partial<ResponsePaginatedDto<T>>) {
    const { data, meta } = partial;

    Object.assign(this, {
      data,
      meta: new ResponseMetaDto(meta),
    });
  }
}
