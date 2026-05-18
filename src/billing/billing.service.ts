import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sessionLimitForPlan } from '../common/billing.constants';
import type { UserPlan } from '../users/user-plan';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

    try {
      await this.notificationsService.recordPackPurchase({
        purchaserEmail: em,
        purchaserName: doc.name,
        previousPlan: current,
        newPlan: plan,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Pack purchase logged but admin notification failed: ${msg}`);
    }

    return { ok: true, plan };
  }
}
