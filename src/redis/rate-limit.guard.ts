import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';
import { RedisService } from './redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const key = `aic:ratelimit:${options.prefix}:${ip}`;
    const { count, ok } = await this.redis.incrWithTtl(
      key,
      options.windowSeconds,
    );

    // Auth: fail-closed when Redis is down (cannot enforce limit safely).
    // Evaluation routes may set failClosed:false to fail-open.
    if (!ok) {
      if (options.failClosed !== false) {
        throw new HttpException(
          'Rate limiter unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return true;
    }

    if (count > options.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfterSeconds: options.windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
