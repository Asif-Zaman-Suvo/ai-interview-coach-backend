import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';
import { APIError } from 'better-auth/api';
import { hashPassword } from 'better-auth/crypto';
import { loadDatabaseConfig } from '../database/database.config';
import { loadBetterAuthEnvConfig } from './better-auth.config';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  passwordMeetsPolicy,
} from '../common/validation/password-policy';

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
    advanced: {
      cookies: {
        sessionToken: {
          attributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      },
    },
    database: mongodbAdapter(db, {
      client,
      transaction: authCfg.useMongoTransactions,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      password: {
        hash: async (password: string) => {
          if (!passwordMeetsPolicy(password)) {
            throw APIError.from('BAD_REQUEST', {
              code: 'PASSWORD_TOO_WEAK',
              message: PASSWORD_POLICY_MESSAGE,
            });
          }
          return hashPassword(password);
        },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
      },
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
