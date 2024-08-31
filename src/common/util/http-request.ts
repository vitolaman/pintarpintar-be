import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class HttpRequestUtility extends HttpService {
  constructor() {
    super();
  }

  override post<T = any>(
    url: string,
    data?: Record<string, any>,
    config?: AxiosRequestConfig,
  ): Observable<AxiosResponse<T>> {
    return super.post(url, data, config).pipe(
      map((response: AxiosResponse) => {
        return response;
      }),
    );
  }

  override get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Observable<AxiosResponse<T>> {
    return super.get(url, config).pipe(
      map((response: AxiosResponse) => {
        return response;
      }),
    );
  }
}
