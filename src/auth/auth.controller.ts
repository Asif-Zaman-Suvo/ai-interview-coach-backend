import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { UserSession } from './auth.types';
import { SignUpDto } from './dto/sign-up.dto';
import { Session } from './session.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @AllowAnonymous()
  @Post('register')
  register(@Body() dto: SignUpDto, @Req() req: Request) {
    return this.authService.registerWithEmail(dto, req);
  }

  @Get('me')
  me(@Session() session: UserSession) {
    return session;
  }
}
