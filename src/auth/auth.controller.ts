import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import type { UserRole } from '../users/user-role';
import { AuthService } from './auth.service';
import type { UserSession } from './auth.types';
import { SignUpDto } from './dto/sign-up.dto';
import { Session } from './session.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @AllowAnonymous()
  @Post('register')
  register(@Body() dto: SignUpDto, @Req() req: Request) {
    return this.authService.registerWithEmail(dto, req);
  }

  @Get('me')
  async me(@Session() session: UserSession) {
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email || !session.user) {
      return session;
    }
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
