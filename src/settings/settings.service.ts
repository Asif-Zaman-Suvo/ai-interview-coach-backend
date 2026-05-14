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
import type { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly testimonialsService: TestimonialsService,
    private readonly authService: AuthService,
  ) {}

  async getForEmail(email: string) {
    const em = email.trim().toLowerCase();
    await this.usersService.createProfileIfAbsent({ email: em });
    const doc = await this.usersService.findByEmail(em);
    return this.serialize(doc, em);
  }

  private serialize(doc: UserDocument | null, email: string) {
    return {
      email,
      name: doc?.name ?? '',
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
