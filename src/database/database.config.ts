import { requireEnv } from '../common/env';

export interface DatabaseConfig {
  uri: string;
  dbName: string | undefined;
}

export function loadDatabaseConfig(): DatabaseConfig {
  return {
    uri: requireEnv('MONGODB_URI'),
    dbName: process.env.MONGODB_DB?.trim() || undefined,
  };
}
