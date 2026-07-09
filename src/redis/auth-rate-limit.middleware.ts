import type { NextFunction, Request, Response } from 'express';
import type { RedisService } from '../redis/redis.service';

/**
 * Rate-limit Better Auth routes that bypass Nest controllers
 * (`/api/auth/sign-in/*`, `/api/auth/sign-up/*`).
 * Fail-closed: 503 when Redis is unavailable.
 */
export function createAuthRateLimitMiddleware(redis: RedisService) {
  const limit = Number(process.env.AUTH_RATE_LIMIT ?? 20);
  const windowSeconds = Number(process.env.AUTH_RATE_WINDOW_SECONDS ?? 60);

  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || '';
    const isAuthSensitive =
      path.startsWith('/api/auth/sign-in') ||
      path.startsWith('/api/auth/sign-up');
    if (!isAuthSensitive || req.method === 'GET' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const key = `aic:ratelimit:auth-better:${ip}`;
    const { count, ok } = await redis.incrWithTtl(key, windowSeconds);

    if (!ok) {
      res.status(503).json({ message: 'Rate limiter unavailable' });
      return;
    }
    if (count > limit) {
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        retryAfterSeconds: windowSeconds,
      });
      return;
    }
    next();
  };
}
