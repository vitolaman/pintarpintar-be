export class ResponseDto<T> {
  data: T;

  constructor(partial: Partial<ResponseDto<T>>) {
    Object.assign(this, partial);
  }
}

export class ResponseArrayDto<T> {
  data: T[];

  constructor(partial: Partial<ResponseArrayDto<T>>) {
    const { data } = partial;
    Object.assign(this, {
      data,
    });
  }
}
