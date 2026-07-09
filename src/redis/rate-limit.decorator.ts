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
   * When true (auth routes): if Redis is unavailable, reject with 503.
   * Fail-closed for sensitive auth. Non-auth expensive routes may set false
   * to fail-open (allow) when Redis is down.
   */
  failClosed?: boolean;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
