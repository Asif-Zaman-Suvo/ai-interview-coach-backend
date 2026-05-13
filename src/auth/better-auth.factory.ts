import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';
import { loadDatabaseConfig } from '../database/database.config';
import { loadBetterAuthEnvConfig } from './better-auth.config';

export async function createBetterAuthRootOptions() {
  const dbCfg = loadDatabaseConfig();
  const authCfg = loadBetterAuthEnvConfig();

  const client = new MongoClient(dbCfg.uri);
  await client.connect();
  const db = dbCfg.dbName ? client.db(dbCfg.dbName) : client.db();

  const auth = betterAuth({
    basePath: '/api/auth',
    secret: authCfg.secret,
    baseURL: authCfg.baseURL,
    trustedOrigins: [authCfg.frontendUrl],
    database: mongodbAdapter(db, {
      client,
      transaction: authCfg.useMongoTransactions,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
  });

  return {
    auth,
    bodyParser: {
      json: { limit: '2mb' },
      urlencoded: { limit: '2mb', extended: true },
    },
  };
}
