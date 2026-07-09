import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { loadRedisConfig } from './redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private ready = false;

  onModuleInit(): void {
    const { url } = loadRedisConfig();
    const redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    redis.on('ready', () => {
      this.ready = true;
      this.logger.log('Redis connected');
    });
    redis.on('error', (err) => {
      this.ready = false;
      this.logger.warn(`Redis error: ${err.message}`);
    });
    redis.on('end', () => {
      this.ready = false;
    });

    this.client = redis;
    void redis.connect().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis connect failed (cache fail-open): ${message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready && this.client?.status === 'ready';
  }

  /** Ping Redis; used by /health. */
  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Cache reads fail-open: on Redis errors return null so callers hit Mongo.
   */
  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isReady()) return null;
    try {
      const raw = await this.client.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`cache get fail-open ${key}: ${message}`);
      return null;
    }
  }

  /**
   * Cache writes fail-open: swallow errors so request path stays healthy.
   */
  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.isReady()) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`cache set fail-open ${key}: ${message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || !this.isReady() || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`cache del fail-open: ${message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client || !this.isReady()) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`cache delByPattern fail-open ${pattern}: ${message}`);
    }
  }

  /**
   * Fixed-window rate limit via INCR + EXPIRE.
   * Auth routes: fail-closed (throw / treat as limited) when Redis is down —
   * see RateLimitGuard.
   */
  async incrWithTtl(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ok: boolean }> {
    if (!this.client || !this.isReady()) {
      return { count: 0, ok: false };
    }
    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return { count, ok: true };
    } catch {
      return { count: 0, ok: false };
    }
  }
}
