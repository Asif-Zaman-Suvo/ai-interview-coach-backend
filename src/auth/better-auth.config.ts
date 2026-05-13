import { requireEnv } from '../common/env';

export interface BetterAuthEnvConfig {
  secret: string;
  port: number;
  baseURL: string;
  frontendUrl: string;
  useMongoTransactions: boolean;
}

export function loadBetterAuthEnvConfig(): BetterAuthEnvConfig {
  const port = Number(process.env.PORT ?? 3333);
  return {
    secret: requireEnv('BETTER_AUTH_SECRET'),
    port,
    baseURL: process.env.BETTER_AUTH_URL?.trim() || `http://localhost:${port}`,
    frontendUrl: process.env.FRONTEND_URL?.trim() || 'http://localhost:3000',
    useMongoTransactions:
      process.env.MONGO_TRANSACTIONS?.trim().toLowerCase() === 'true',
  };
}
