import 'dotenv/config';
import { emitKeypressEvents } from 'node:readline';
import { MongoClient } from 'mongodb';
import { loadDatabaseConfig } from '../database/database.config';
import {
  passwordMeetsPolicy,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
} from '../common/validation/password-policy';

/** Interactive local recovery only; no password arguments or environment inputs. */
export function readHiddenPassword(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Use an interactive terminal; passwords cannot be passed through stdin.',
    );
  }
  return new Promise((resolve, reject) => {
    let password = '';
    const wasRaw = process.stdin.isRaw;
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = () => {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKey = (
      text: string | undefined,
      key: { name?: string; ctrl?: boolean },
    ) => {
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
        finish();
        password = '';
        reject(new Error('Password reset cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
        resolve(password);
        password = '';
      } else if (key.name === 'backspace' || key.name === 'delete') {
        password = Array.from(password).slice(0, -1).join('');
      } else if (
        text &&
        !key.ctrl &&
        Array.from(text).every((char) => {
          const code = char.codePointAt(0)!;
          return code >= 32 && code !== 127;
        })
      ) {
        password += text;
      }
    };
    process.stdin.on('keypress', onKey);
    process.stdout.write(label);
  });
}

export async function resetPassword(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length !== 2 ||
    args[0] !== '--local-dev' ||
    !args[1].includes('@')
  ) {
    throw new Error(
      'Usage: node dist/seeds/reset-password.js --local-dev <existing-admin-email>',
    );
  }
  const email = args[1].trim().toLowerCase();
  const config = loadDatabaseConfig();
  // Docker production images also serve local development, so NODE_ENV is not
  // sufficient. Explicit opt-in plus local database addressing is required.
  const uri = new URL(config.uri);
  if (
    uri.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]', 'mongo'].includes(uri.hostname)
  ) {
    throw new Error(
      'This recovery CLI only permits local MongoDB or the Compose mongo service.',
    );
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET must be configured.');
  const client = new MongoClient(config.uri);
  try {
    await client.connect();
    const db = config.dbName ? client.db(config.dbName) : client.db();
    const user = await db.collection('user').findOne({ email });
    const profile = await db.collection('user_profiles').findOne({ email });
    if (!user || profile?.role !== 'admin') {
      throw new Error(
        'No existing admin account found for this email in the selected database.',
      );
    }
    const credentials = await db
      .collection('account')
      .find({
        providerId: 'credential',
        userId: { $in: [user._id, String(user._id)] },
      })
      .toArray();
    if (
      credentials.length !== 1 ||
      typeof credentials[0].password !== 'string'
    ) {
      throw new Error(
        'Expected exactly one existing email/password credential; no changes made.',
      );
    }
    let password = await readHiddenPassword('New password (hidden): ');
    if (!passwordMeetsPolicy(password))
      throw new Error(PASSWORD_POLICY_MESSAGE);
    let confirmation = await readHiddenPassword('Confirm password (hidden): ');
    if (password !== confirmation)
      throw new Error('Passwords do not match; no changes made.');
    confirmation = '';

    // Use the same library hasher as the application; Better Auth manages the
    // reset token, hash persistence, and token consumption itself.
    const { betterAuth } = await import('better-auth');
    const { mongodbAdapter } = await import('@better-auth/mongo-adapter');
    const { hashPassword } = await import('better-auth/crypto');
    let token: string | undefined;
    const auth = betterAuth({
      secret,
      baseURL: 'http://localhost:3333',
      database: mongodbAdapter(db, { client, transaction: false }),
      logger: { disabled: true },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: PASSWORD_MIN_LENGTH,
        maxPasswordLength: PASSWORD_MAX_LENGTH,
        password: { hash: hashPassword },
        // Local-only token capture; no emails and no token/password logging.
        sendResetPassword: (data) => {
          token = data.token;
          return Promise.resolve();
        },
      },
    });
    await auth.api.requestPasswordReset({ body: { email } });
    if (!token)
      throw new Error(
        'Better Auth did not issue a reset token; no password changed.',
      );
    await auth.api.resetPassword({ body: { token, newPassword: password } });
    password = '';
    token = undefined;
    console.log(
      'Admin password reset successfully. User ID, profile, role and interview data preserved.',
    );
  } finally {
    await client.close();
  }
}

// This file is a CLI entry point and is not imported by application modules.
void resetPassword().catch((error: unknown) => {
  // Only our known validation errors are safe to display. Library/database
  // errors may contain connection credentials or request data.
  const safePrefixes = [
    'Usage:',
    'Use an interactive',
    'Password reset cancelled',
    'Password must',
    'Passwords do not match',
    'This recovery CLI',
    'BETTER_AUTH_SECRET must',
    'No existing admin',
    'Expected exactly',
    'Better Auth did not issue',
  ];
  const message = error instanceof Error ? error.message : '';
  console.error(
    safePrefixes.some((prefix) => message.startsWith(prefix))
      ? message
      : 'Password reset failed. Check local database connectivity and configuration.',
  );
  process.exitCode = 1;
});
