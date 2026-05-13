import { Controller, Get } from '@nestjs/common';
import type { UserSession } from './auth.types';
import { Session } from './session.decorator';

/**
 * Nest-facing auth helpers. Credential flows are served by Better Auth at `/api/auth/*`
 * (e.g. `POST /api/auth/sign-in/email`); use the Better Auth client or those routes from SPA/mobile.
 */
@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Session() session: UserSession) {
    return session;
  }
}
