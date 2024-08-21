/* eslint-disable no-console */
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, CacheStore } from '@nestjs/cache-manager';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: CacheStore) {}

  async getCache(key: string) {
    try {
      let data = await this.cacheManager.get(key);
      if (data) data = JSON.parse(data as string);
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async saveCache(key: string, value, secondsToExpired = undefined) {
    try {
      return this.cacheManager.set(key, JSON.stringify(value), {
        ttl: secondsToExpired,
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async removeCache(key: string) {
    try {
      return this.cacheManager.del(key);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
