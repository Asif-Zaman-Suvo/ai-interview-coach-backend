import { Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v?.trim()) {
    throw new Error(`${key} is required`);
  }
  return v.trim();
}

@Module({
  imports: [
    AuthModule.forRootAsync({
      isGlobal: true,
      useFactory: async () => {
        const uri = requireEnv('MONGODB_URI');
        const secret = requireEnv('BETTER_AUTH_SECRET');
        const port = Number(process.env.PORT ?? 3333);
        const baseURL =
          process.env.BETTER_AUTH_URL?.trim() || `http://localhost:${port}`;
        const frontendUrl =
          process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
        const useTransactions =
          process.env.MONGO_TRANSACTIONS?.trim().toLowerCase() === 'true';

        const client = new MongoClient(uri);
        await client.connect();
        const dbName = process.env.MONGODB_DB?.trim();
        const db = dbName ? client.db(dbName) : client.db();

        const auth = betterAuth({
          basePath: '/api/auth',
          secret,
          baseURL,
          trustedOrigins: [frontendUrl],
          database: mongodbAdapter(db, {
            client,
            transaction: useTransactions,
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
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
