import { Injectable } from '@nestjs/common';
import { AuthService as BetterAuthIntegrationService } from '@thallesp/nestjs-better-auth';

@Injectable()
export class AuthService {
  constructor(private readonly betterAuth: BetterAuthIntegrationService) {}

  get api() {
    return this.betterAuth.api;
  }

  get instance() {
    return this.betterAuth.instance;
  }
}
