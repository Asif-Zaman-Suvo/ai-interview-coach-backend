import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import type { UserRole } from '../users/user-role';
import { AuthService } from './auth.service';
import type { UserSession } from './auth.types';
import { SignUpDto } from './dto/sign-up.dto';
import { Session } from './session.decorator';
import { RateLimit } from '../redis/rate-limit.decorator';
import { RateLimitGuard } from '../redis/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @AllowAnonymous()
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 10,
    windowSeconds: 60,
    prefix: 'auth-register',
    // Fail-open unless AUTH_RATE_LIMIT_FAIL_CLOSED=true (needs REDIS_URL).
    failClosed: false,
  })
  register(@Body() dto: SignUpDto, @Req() req: Request) {
    return this.authService.registerWithEmail(dto, req);
  }

  @Get('me')
  async me(@Session() session: UserSession) {
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email || !session.user) {
      return session;
    }
    await this.usersService.createProfileIfAbsent({
      email,
      name:
        typeof session.user.name === 'string' ? session.user.name.trim() : undefined,
    });
    const profileRole: UserRole =
      await this.usersService.getRoleForEmail(email);
    const user = session.user;
    return {
      ...session,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image ?? null,
        role: profileRole,
      },
    };
  }
}
