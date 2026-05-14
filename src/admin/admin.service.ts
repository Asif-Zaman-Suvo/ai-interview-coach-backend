import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Session, SessionDocument } from '../sessions/session.schema';
import { RolesService } from '../roles/roles.service';
import { QuestionsService } from '../questions/questions.service';
import { UsersService } from '../users/users.service';
import type { UserPlan } from '../users/user-plan';
import { normalizeUserPlan } from '../users/user-plan';
import { PRIMARY_QUESTION_BANK_SESSION_ID } from '../questions/question-bank.constants';

/** Better Auth Mongo adapter default (`usePlural: false`). */
const BETTER_AUTH_USER_COLLECTION = 'user';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly rolesService: RolesService,
    private readonly questionsService: QuestionsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * App profiles live in `user_profiles`. Sign-ups via `/api/auth/...` do not hit
   * Nest `POST /auth/register`, so ensure every Better Auth account has a profile row.
   */
  async syncBetterAuthUsersIntoProfiles(): Promise<void> {
    const mongoDb = this.userModel.db;
    if (!mongoDb) return;
    let authUsers: { email?: string; name?: string }[];
    try {
      authUsers = await mongoDb
        .collection(BETTER_AUTH_USER_COLLECTION)
        .find<{ email?: string; name?: string }>({}, { projection: { email: 1, name: 1 } })
        .toArray();
    } catch {
      return;
    }
    for (const au of authUsers) {
      const email = au.email?.trim().toLowerCase();
      if (!email) continue;
      await this.usersService.createProfileIfAbsent({
        email,
        name: typeof au.name === 'string' ? au.name.trim() : undefined,
      });
    }
  }

  private countInterviewSessionsForAuthUserId(
    authUserId: string,
  ): Promise<number> {
    const id = (authUserId ?? '').trim();
    if (!id) return Promise.resolve(0);
    const filter =
      /^[a-f0-9]{24}$/i.test(id)
        ? { $or: [{ userId: id }, { userId: new Types.ObjectId(id) }] }
        : { userId: id };
    return this.sessionModel.countDocuments(filter as Record<string, unknown>).exec();
  }

  /** Admin list rows: profile + session count (sessions are keyed by Better Auth user id). */
  async getAdminUsersList(): Promise<
    {
      id: string;
      email: string;
      name?: string;
      role: User['role'];
      plan: UserPlan;
      createdAt?: Date;
      sessionsCount: number;
    }[]
  > {
    await this.syncBetterAuthUsersIntoProfiles();
    const users = await this.userModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const mongoDb = this.userModel.db;
    const authIdByEmail = new Map<string, string>();
    if (mongoDb) {
      try {
        const rows = await mongoDb
          .collection(BETTER_AUTH_USER_COLLECTION)
          .find<{ _id: Types.ObjectId; email?: string }>(
            {},
            { projection: { _id: 1, email: 1 } },
          )
          .toArray();
        for (const row of rows) {
          const em = row.email?.trim().toLowerCase();
          if (em) authIdByEmail.set(em, row._id.toString());
        }
      } catch {
        /* ok */
      }
    }

    const uniqueAuthIds = [...new Set(authIdByEmail.values())];
    const sessionCountByAuthId = new Map<string, number>();
    await Promise.all(
      uniqueAuthIds.map(async (aid) => {
        sessionCountByAuthId.set(
          aid,
          await this.countInterviewSessionsForAuthUserId(aid),
        );
      }),
    );

    return users.map((u) => {
      const key = u.email.trim().toLowerCase();
      const authId = authIdByEmail.get(key);
      const sessionsCount = authId
        ? (sessionCountByAuthId.get(authId) ?? 0)
        : 0;
      return {
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role,
        plan: normalizeUserPlan(u.plan as string | undefined),
        createdAt: u.createdAt,
        sessionsCount,
      };
    });
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalSessions: number;
    averageScore: number;
    activeToday: number;
  }> {
    await this.syncBetterAuthUsersIntoProfiles();
    const totalUsers = await this.userModel.countDocuments().exec();
    const totalSessions = await this.sessionModel.countDocuments().exec();

    const completedSessions = await this.sessionModel
      .find({ status: 'completed' })
      .exec();
    const averageScore =
      completedSessions.length > 0
        ? Math.round(
            completedSessions.reduce((sum, s) => sum + s.score, 0) /
              completedSessions.length,
          )
        : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeToday = await this.sessionModel
      .countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
      })
      .exec();

    return {
      totalUsers,
      totalSessions,
      averageScore,
      activeToday,
    };
  }

  async updateUserRole(
    userId: string,
    role: 'user' | 'admin',
  ): Promise<User | null> {
    if (role === 'user') {
      const target = await this.userModel.findById(userId).exec();
      if (target?.role === 'admin') {
        const adminCount = await this.userModel
          .countDocuments({ role: 'admin' })
          .exec();
        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot demote the only administrator. Promote another user first.',
          );
        }
      }
    }
    return this.userModel
      .findByIdAndUpdate(userId, { role }, { new: true })
      .exec();
  }

  async updateUserPlan(profileId: string, plan: UserPlan): Promise<User | null> {
    const allowed: UserPlan[] = ['free', 'pack_10', 'pack_30'];
    if (!allowed.includes(plan)) {
      throw new BadRequestException('plan must be free, pack_10, or pack_30');
    }
    return this.usersService.updatePlanByProfileId(profileId, plan);
  }

  async deleteUser(
    userId: string,
    actorEmail?: string | null,
  ): Promise<User | null> {
    const target = await this.userModel.findById(userId).exec();
    if (!target) {
      return null;
    }
    const actor = actorEmail?.trim().toLowerCase();
    const targetEmail = target.email.trim().toLowerCase();
    if (actor && actor === targetEmail) {
      throw new BadRequestException(
        'You cannot delete your own account from the admin panel.',
      );
    }
    return this.userModel.findByIdAndDelete(userId).exec();
  }

  async getQuestionBank(): Promise<
    {
      id: string;
      roleId: string;
      role: string;
      text: string;
      idealAnswer: string;
      type: 'technical' | 'behavioral';
      difficulty: string;
      createdAt?: Date;
    }[]
  > {
    const roles = await this.rolesService.findAll();
    const nameById = new Map(roles.map((r) => [String(r._id), r.name]));
    const qs = await this.questionsService.findAllBank();

    return qs.map((q) => ({
      id: String(q._id),
      roleId: q.roleId,
      role: nameById.get(q.roleId) ?? 'Unknown',
      text: q.text,
      idealAnswer: q.idealAnswer,
      type: q.type,
      difficulty: q.difficulty,
      createdAt: q.createdAt,
    }));
  }

  async createQuestion(questionData: {
    roleId: string;
    text: string;
    idealAnswer: string;
    type: 'technical' | 'behavioral';
    difficulty: string;
  }) {
    return this.questionsService.create({
      ...questionData,
      sessionId: PRIMARY_QUESTION_BANK_SESSION_ID,
    });
  }

  async updateQuestion(
    questionId: string,
    questionData: {
      text?: string;
      idealAnswer?: string;
      type?: 'technical' | 'behavioral';
      difficulty?: string;
    },
  ): Promise<unknown> {
    return this.questionsService.update(questionId, questionData);
  }

  async deleteQuestion(questionId: string): Promise<unknown> {
    return this.questionsService.delete(questionId);
  }

  async createRole(roleData: {
    name: string;
    icon: string;
    description: string;
  }) {
    return this.rolesService.create(roleData);
  }

  async updateRole(
    id: string,
    roleData: { name?: string; icon?: string; description?: string },
  ) {
    return this.rolesService.update(id, roleData);
  }

  async deleteRole(id: string) {
    return this.rolesService.delete(id);
  }
}