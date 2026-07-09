import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [RedisService, RateLimitGuard],
  exports: [RedisService, RateLimitGuard],
})
export class RedisModule {}
