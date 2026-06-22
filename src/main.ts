import 'dotenv/config';
import type { NextFunction, Request, Response } from 'express';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAppValidationPipe } from './common/pipes/validation.pipe';

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
    origin: process.env.FRONTEND_URL?.trim() ?? 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
}
bootstrap();
