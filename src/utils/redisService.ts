// src/utils/redisService.ts
import redis from "../config/redisClient";
import { env } from "../config/env";

class RedisService {
  private prefixKey(key: string): string {
    return `${env.REDIS_NAMESPACE}:${key}`;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);
      if (ttlSeconds) {
        await redis.set(prefixedKey, value, { ex: ttlSeconds });
      } else {
        await redis.set(prefixedKey, value);
      }
    } catch (error) {
      console.error(`[Redis] Failed to SET key "${key}":`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await redis.get<string>(this.prefixKey(key));
      return value ?? null;
    } catch (error) {
      console.error(`[Redis] Failed to GET key "${key}":`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(this.prefixKey(key));
    } catch (error) {
      console.error(`[Redis] Failed to DELETE key "${key}":`, error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(this.prefixKey(key));
    } catch (error) {
      console.error(`[Redis] Failed to get TTL for key "${key}":`, error);
      return -2;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(this.prefixKey(key));
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Failed to check existence of key "${key}":`, error);
      return false;
    }
  }
}

export default new RedisService();