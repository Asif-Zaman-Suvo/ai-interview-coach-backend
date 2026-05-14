import { Controller, Get, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SessionsService } from '../sessions/sessions.service';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly sessionsService: SessionsService) {}

  @AllowAnonymous()
  @Get('dashboard-preview')
  async dashboardPreview(@Query('recentLimit') recentLimit?: string) {
    const n = Number(recentLimit);
    const lim = Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 3;
    return this.sessionsService.getPublicLandingDashboardPreview(lim);
  }
}
