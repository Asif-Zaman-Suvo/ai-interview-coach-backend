import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sessionLimitForPlan } from '../common/billing.constants';
import type { UserPlan } from '../users/user-plan';
import { UsersService } from '../users/users.service';

@Injectable()
export class BillingService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Applies a paid plan to the signed-in user for QA / demos.
   * Disabled when `DUMMY_PAYMENT_ENABLED=false`.
   */
  async dummyPurchase(
    email: string,
    plan: 'pack_10' | 'pack_30',
  ): Promise<{ ok: true; plan: UserPlan }> {
    if (process.env.DUMMY_PAYMENT_ENABLED === 'false') {
      throw new ServiceUnavailableException(
        'Sandbox payments are disabled on this server.',
      );
    }

    const em = email.trim().toLowerCase();
    if (!em) {
      throw new BadRequestException('Missing account email');
    }

    await this.usersService.createProfileIfAbsent({ email: em });

    const current = await this.usersService.getPlanForEmail(em);
    const currentLimit = sessionLimitForPlan(current);
    const newLimit = sessionLimitForPlan(plan);

    if (newLimit < currentLimit) {
      throw new BadRequestException(
        'Your account already has a pack with more interviews.',
      );
    }

    if (current === plan) {
      return { ok: true, plan: current };
    }

    const doc = await this.usersService.findByEmail(em);
    if (!doc?._id) {
      throw new BadRequestException('Could not load billing profile');
    }

    await this.usersService.updatePlanByProfileId(String(doc._id), plan);
    return { ok: true, plan };
  }
}
