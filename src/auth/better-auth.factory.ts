import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { MongoClient } from 'mongodb';
import { APIError } from 'better-auth/api';
import { hashPassword } from 'better-auth/crypto';
import { Logger } from '@nestjs/common';
import { loadDatabaseConfig } from '../database/database.config';
import { loadBetterAuthEnvConfig } from './better-auth.config';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  passwordMeetsPolicy,
} from '../common/validation/password-policy';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

const log = new Logger('BetterAuth');

export async function createBetterAuthRootOptions(
  usersService: UsersService,
  notificationsService: NotificationsService,
) {
  const dbCfg = loadDatabaseConfig();
  const authCfg = loadBetterAuthEnvConfig();

  const client = new MongoClient(dbCfg.uri);
  await client.connect();
  const db = dbCfg.dbName ? client.db(dbCfg.dbName) : client.db();

  const auth = betterAuth({
    basePath: '/api/auth',
    secret: authCfg.secret,
    baseURL: authCfg.baseURL,
    trustedOrigins: authCfg.trustedOrigins,
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
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const email =
              typeof user.email === 'string'
                ? user.email.trim().toLowerCase()
                : '';
            if (!email) return;
            const name =
              typeof user.name === 'string' ? user.name.trim() : undefined;
            try {
              await usersService.createProfileIfAbsent({ email, name });
              await notificationsService.recordUserSignup({
                email,
                name,
                plan: 'free',
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              log.warn(`Post-signup profile/notify failed: ${msg}`);
            }
          },
        },
      },
    },
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
