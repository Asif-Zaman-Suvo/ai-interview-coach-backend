import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  /** Max requests in the window */
  limit: number;
  /** Window length in seconds */
  windowSeconds: number;
  /** Key prefix under aic:ratelimit: */
  prefix: string;
  /**
   * When true: if Redis is unavailable, reject with 503.
   * Default/false: fail-open (allow) when Redis is down — required for
   * hosts without REDIS_URL (e.g. Render). Opt into fail-closed via
   * AUTH_RATE_LIMIT_FAIL_CLOSED=true when Redis is provisioned.
   */
  failClosed?: boolean;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
