import 'dotenv/config';
import type { NextFunction, Request, Response } from 'express';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAppValidationPipe } from './common/pipes/validation.pipe';
import { INSTANCE_ID } from './common/instance-id';
import { RedisService } from './redis/redis.service';
import { createAuthRateLimitMiddleware } from './redis/auth-rate-limit.middleware';

function parseCorsOrigins(): string | string[] {
  const raw = process.env.FRONTEND_URL?.trim() ?? 'http://localhost:3000';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length <= 1 ? (list[0] ?? 'http://localhost:3000') : list;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.useGlobalPipes(createAppValidationPipe());

  // Align with deployments that mount the Nest app behind /api; Better Auth stays on /api/auth/*.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'auth/me', method: RequestMethod.GET },
      { path: 'auth/register', method: RequestMethod.POST },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Instance-Id', INSTANCE_ID);
    next();
  });

  const redis = app.get(RedisService);
  app.use(createAuthRateLimitMiddleware(redis));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = (name: string, value: string | number | readonly string[]) => {
      if (name.toLowerCase() === 'set-cookie') {
        const cookies = Array.isArray(value) ? value : [String(value)];
        const patched = cookies.map((c) =>
          c.replace(/;\s*SameSite=\w+/gi, '').replace(/;\s*Secure/gi, '') +
          '; SameSite=None; Secure',
        );
        return originalSetHeader(name, patched);
      }
      return originalSetHeader(name, value);
    };
    next();
  });

  app.enableCors({
    origin: parseCorsOrigins(),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['X-Instance-Id'],
  });

  // Trust Nginx / Docker proxy for X-Forwarded-* (rate limit IP + cookies).
  const expressApp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  expressApp.set?.('trust proxy', 1);

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
}
bootstrap();
