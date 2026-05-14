import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { UserRole } from './user-role';
import { normalizeUserPlan, type UserPlan } from './user-plan';
import type { UserDocument } from './user.schema';
import { User } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  get mongoDb() {
    return this.userModel.db;
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  getRoleForEmail(email: string): Promise<UserRole> {
    return this.findByEmail(email).then((doc) => {
      if (!doc) return 'user';
      return doc.role === 'admin' ? 'admin' : 'user';
    });
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async getPlanForEmail(email: string): Promise<UserPlan> {
    const doc = await this.findByEmail(email);
    return normalizeUserPlan(doc?.plan as string | undefined);
  }

  updatePlanByProfileId(
    profileId: string,
    plan: UserPlan,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(profileId, { plan }, { new: true })
      .exec();
  }

  async update(id: string, patch: Partial<Pick<User, 'email' | 'name'>>) {
    return this.userModel.findByIdAndUpdate(id, patch, { new: true }).exec();
  }

  async createProfileIfAbsent(params: { email: string; name?: string }) {
    const email = params.email.toLowerCase();
    return this.userModel
      .findOneAndUpdate(
        { email },
        { $setOnInsert: { email, name: params.name, plan: 'free' as const } },
        { upsert: true, new: true },
      )
      .exec();
  }

  async deleteProfileByEmail(email: string): Promise<void> {
    await this.userModel.deleteOne({ email: email.toLowerCase() }).exec();
  }

  async updateSettingsByEmail(
    email: string,
    patch: {
      name?: string;
      weeklyDigest?: boolean;
      sessionReminders?: boolean;
      productTips?: boolean;
      interviewDefaultRole?: string | null;
      interviewDefaultDifficulty?: string | null;
    },
  ): Promise<UserDocument | null> {
    const em = email.toLowerCase();
    const $set: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      $set.name = patch.name.trim() || undefined;
    }
    if (patch.weeklyDigest !== undefined) {
      $set.weeklyDigest = patch.weeklyDigest;
    }
    if (patch.sessionReminders !== undefined) {
      $set.sessionReminders = patch.sessionReminders;
    }
    if (patch.productTips !== undefined) {
      $set.productTips = patch.productTips;
    }
    if (patch.interviewDefaultRole !== undefined) {
      const v = patch.interviewDefaultRole?.trim();
      $set.interviewDefaultRole = v === '' || v == null ? undefined : v;
    }
    if (patch.interviewDefaultDifficulty !== undefined) {
      const v = patch.interviewDefaultDifficulty?.trim();
      $set.interviewDefaultDifficulty =
        v === '' || v == null ? undefined : v;
    }
    return this.userModel
      .findOneAndUpdate({ email: em }, { $set }, { new: true })
      .exec();
  }
}
