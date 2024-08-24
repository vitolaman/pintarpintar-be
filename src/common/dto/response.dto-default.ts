export class ResponseDto<T> {
  data: T;
  responseMessage: string;

  constructor(partial: Partial<ResponseDto<T>>) {
    Object.assign(this, partial);
  }
}

export class ResponseArrayDto<T> {
  data: T[];
  responseMessage: string;

  constructor(partial: Partial<ResponseArrayDto<T>>) {
    Object.assign(this, partial);
  }
}
