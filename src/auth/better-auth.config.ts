import { requireEnv } from '../common/env';

export interface BetterAuthEnvConfig {
  secret: string;
  port: number;
  baseURL: string;
  frontendUrl: string;
  trustedOrigins: string[];
  useMongoTransactions: boolean;
}

function splitOrigins(raw: string | undefined, fallback: string): string[] {
  const list = (raw ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [fallback];
}

export function loadBetterAuthEnvConfig(): BetterAuthEnvConfig {
  const port = Number(process.env.PORT ?? 3333);
  const frontendUrl =
    process.env.FRONTEND_URL?.trim().split(',')[0]?.trim() ||
    'http://localhost:3000';
  return {
    secret: requireEnv('BETTER_AUTH_SECRET'),
    port,
    baseURL: process.env.BETTER_AUTH_URL?.trim() || `http://localhost:${port}`,
    frontendUrl,
    trustedOrigins: splitOrigins(
      process.env.FRONTEND_URL,
      'http://localhost:3000',
    ),
    useMongoTransactions:
      process.env.MONGO_TRANSACTIONS?.trim().toLowerCase() === 'true',
  };
}
