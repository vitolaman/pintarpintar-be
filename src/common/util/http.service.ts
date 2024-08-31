import { Injectable } from '@nestjs/common';
import { lastValueFrom, map } from 'rxjs';
import { HttpRequestUtility } from './http-request';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class HttpService {
  private httpService: HttpRequestUtility;

  constructor() {
    this.httpService = new HttpRequestUtility();
  }

  async post(pathUrl: string, payload, headers) {
    try {
      const result = await lastValueFrom(
        this.httpService
          .post(pathUrl, payload, {
            headers,
          })
          .pipe(map((res) => res)),
      );
      return result.data;
    } catch (error) {
      return error.response.data;
    }
  }

  async get(
    pathUrl: string,
    params: Record<string, any>,
    headers: Record<string, any>,
  ) {
    try {
      const config: AxiosRequestConfig = {
        params,
        headers,
      };

      const result = await lastValueFrom(
        this.httpService.get(pathUrl, config).pipe(map((res) => res)),
      );
      return result.data;
    } catch (error) {
      return error.response.data;
    }
  }
}
