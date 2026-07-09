import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { RedisService } from './redis/redis.service';
import { INSTANCE_ID } from './common/instance-id';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly redis: RedisService,
  ) {}

  getHello(): string {
    return 'The backend is running';
  }

  getInstanceId(): string {
    return INSTANCE_ID;
  }

  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    mongo: boolean;
    redis: boolean;
    instanceId: string;
  }> {
    let mongo = false;
    try {
      mongo = this.connection.readyState === 1;
      if (mongo && this.connection.db) {
        await this.connection.db.admin().command({ ping: 1 });
      }
    } catch (err: unknown) {
      mongo = false;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Mongo health ping failed: ${message}`);
    }

    const redis = await this.redis.ping();
    return {
      status: mongo ? 'ok' : 'degraded',
      mongo,
      redis,
      instanceId: INSTANCE_ID,
    };
  }
}
