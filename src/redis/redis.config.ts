export interface RedisConfig {
  url: string;
}

export function loadRedisConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL?.trim() || 'redis://localhost:6379',
  };
}
