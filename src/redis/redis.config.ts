export interface RedisConfig {
  /** When false, Redis is intentionally disabled (no REDIS_URL). */
  enabled: boolean;
  url: string;
}

export function loadRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL?.trim() ?? '';
  if (!url) {
    return { enabled: false, url: '' };
  }
  return { enabled: true, url };
}
