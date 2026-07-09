import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isAPIError } from 'better-auth/api';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/user.schema';
import { normalizeUserPlan, type UserPlan } from '../users/user-plan';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import { RedisService } from '../redis/redis.service';
import { CacheKeys, CacheTtlSeconds } from '../redis/cache-keys';

type SettingsPayload = {
  email: string;
  name: string;
  plan: UserPlan;
  weeklyDigest: boolean;
  sessionReminders: boolean;
  productTips: boolean;
  interviewDefaultRole: string | null;
  interviewDefaultDifficulty: string | null;
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly testimonialsService: TestimonialsService,
    private readonly authService: AuthService,
    private readonly redis: RedisService,
  ) {}

  async getForEmail(email: string) {
    const em = email.trim().toLowerCase();
    const key = CacheKeys.settingsByEmail(em);
    const cached = await this.redis.getJson<SettingsPayload>(key);
    if (cached) return cached;

    await this.usersService.createProfileIfAbsent({ email: em });
    const doc = await this.usersService.findByEmail(em);
    const payload = this.serialize(doc, em);
    await this.redis.setJson(key, payload, CacheTtlSeconds.settings);
    return payload;
  }

  private serialize(doc: UserDocument | null, email: string): SettingsPayload {
    return {
      email,
      name: doc?.name ?? '',
      plan: normalizeUserPlan(doc?.plan as string | undefined),
      weeklyDigest: doc?.weeklyDigest ?? true,
      sessionReminders: doc?.sessionReminders ?? false,
      productTips: doc?.productTips ?? true,
      interviewDefaultRole: doc?.interviewDefaultRole ?? null,
      interviewDefaultDifficulty: doc?.interviewDefaultDifficulty ?? null,
    };
  }

  async update(
    email: string,
    dto: UpdateSettingsDto,
    req?: Request,
  ) {
    const em = email.trim().toLowerCase();
    await this.usersService.createProfileIfAbsent({ email: em });
    const updated = await this.usersService.updateSettingsByEmail(em, {
      name: dto.name,
      weeklyDigest: dto.weeklyDigest,
      sessionReminders: dto.sessionReminders,
      productTips: dto.productTips,
      interviewDefaultRole: dto.interviewDefaultRole ?? undefined,
      interviewDefaultDifficulty: dto.interviewDefaultDifficulty ?? undefined,
    });

    if (dto.name !== undefined && req) {
      const trimmed = dto.name.trim();
      try {
        await this.authService.api.updateUser({
          body: { name: trimmed || em.split('@')[0] || 'User' },
          headers: this.authService.toWebHeaders(req),
        });
      } catch {
        /* profile row still updated */
      }
    }

    await this.redis.del(CacheKeys.settingsByEmail(em));
    return this.serialize(updated, em);
  }

  async deleteAccount(
    req: Request,
    password: string,
    authUserId: string,
    email: string,
  ): Promise<{ ok: true }> {
    const em = email.trim().toLowerCase();
    const uid = authUserId.trim();
    if (!uid || !em) {
      throw new UnauthorizedException('Invalid session');
    }

    const headers = this.authService.toWebHeaders(req);
    try {
      await this.authService.api.verifyPassword({
        body: { password },
        headers,
      });
    } catch (e: unknown) {
      if (isAPIError(e)) {
        const body = e.body as { message?: string } | undefined;
        const message =
          typeof body?.message === 'string'
            ? body.message
            : 'Invalid password';
        throw new BadRequestException(message);
      }
      throw e;
    }

    await this.sessionsService.deleteAllInterviewDataForUser(uid);
    await this.testimonialsService.deleteByUserId(uid);
    await this.usersService.deleteProfileByEmail(em);
    await this.redis.del(CacheKeys.settingsByEmail(em));
    await this.redis.delByPattern('aic:marketing:dashboard:*');

    const db = this.usersService.mongoDb;
    if (db) {
      await db.collection('session').deleteMany({ userId: uid });
      await db.collection('account').deleteMany({ userId: uid });
      if (Types.ObjectId.isValid(uid)) {
        await db
          .collection('user')
          .deleteOne({ _id: new Types.ObjectId(uid) });
      } else {
        await db.collection('user').deleteOne({ _id: uid as never });
      }
    }

    return { ok: true };
  }
}
