import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Session } from '../auth/session.decorator';
import type { UserSession } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { BillingService } from './billing.service';
import { DummyPurchaseDto } from './dto/dummy-purchase.dto';

function sessionEmail(session: UserSession | null | undefined): string {
  const e = session?.user?.email;
  return typeof e === 'string' ? e.trim().toLowerCase() : '';
}

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('dummy-purchase')
  dummyPurchase(
    @Session() session: UserSession,
    @Body() dto: DummyPurchaseDto,
  ) {
    const email = sessionEmail(session);
    if (!email) {
      throw new UnauthorizedException();
    }
    return this.billingService.dummyPurchase(email, dto.plan);
  }
}
