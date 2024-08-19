import { Transform } from 'class-transformer';

export class ResponseMetaDto {
  constructor(partial: Partial<ResponseMetaDto>) {
    Object.assign(this, partial);

    this.total_page = Math.ceil(this.total / this.per_page);
  }

  @Transform(({ value }) => parseInt(value))
  page: number;

  @Transform(({ value }) => parseInt(value))
  per_page: number;

  @Transform(({ value }) => parseInt(value))
  total: number;

  total_page?: number;
}
