import { HttpException, Injectable } from '@nestjs/common';
import { isAPIError } from 'better-auth/api';
import type { Request } from 'express';
import { AuthService as BetterAuthIntegrationService } from '@thallesp/nestjs-better-auth';
import type { SignUpDto } from './dto/sign-up.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly betterAuth: BetterAuthIntegrationService,
    private readonly usersService: UsersService,
  ) {}

  get api() {
    return this.betterAuth.api;
  }

  get instance() {
    return this.betterAuth.instance;
  }

  async registerWithEmail(dto: SignUpDto, req: Request) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim() || email.split('@')[0] || 'User';
    const headers = this.toWebHeaders(req);

    try {
      const result = await this.api.signUpEmail({
        body: { name, email, password: dto.password },
        headers,
      });

      await this.usersService.createProfileIfAbsent({ email, name });

      return result;
    } catch (err: unknown) {
      if (isAPIError(err)) {
        const body = err.body;
        const message =
          body &&
          typeof body === 'object' &&
          'message' in body &&
          typeof (body as { message: unknown }).message === 'string'
            ? (body as { message: string }).message
            : 'Registration failed';
        const code =
          body &&
          typeof body === 'object' &&
          'code' in body &&
          typeof (body as { code: unknown }).code === 'string'
            ? (body as { code: string }).code
            : undefined;
        const status =
          typeof err.statusCode === 'number' ? err.statusCode : 500;
        throw new HttpException({ message, code }, status);
      }
      throw err;
    }
  }

  toWebHeaders(req: Request): Headers {
    const out = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) out.append(key, v);
      } else {
        out.set(key, value);
      }
    }
    return out;
  }
}
