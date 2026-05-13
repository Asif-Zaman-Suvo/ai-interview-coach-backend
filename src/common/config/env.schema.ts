/**
 * Central list of env vars read by this app (see `.env.example`).
 * Validation happens in {@link ../env.requireEnv} and feature-specific `load*Config` helpers.
 */
export const appEnvKeys = [
  'MONGODB_URI',
  'BETTER_AUTH_SECRET',
  'PORT',
  'MONGODB_DB',
  'BETTER_AUTH_URL',
  'FRONTEND_URL',
  'MONGO_TRANSACTIONS',
] as const;

export type AppEnvKey = (typeof appEnvKeys)[number];
