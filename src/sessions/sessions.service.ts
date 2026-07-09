import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnswersService } from '../answers/answers.service';
import { QuestionsService } from '../questions/questions.service';
import type { QuestionDocument } from '../questions/question.schema';
import { RolesService } from '../roles/roles.service';
import { Session, SessionDocument } from './session.schema';
import {
  buildRoleNameMap,
  summarizeSessionForListRow,
} from './sessions-list.mapper';
import { loadOrderedQuestionsForSession } from './session-questions.util';
import { RedisService } from '../redis/redis.service';
import { CacheKeys, CacheTtlSeconds } from '../redis/cache-keys';

/** Mongo filters for interviews (DSL values are intentionally loose vs schema typing). */
type SessionsFindArg = Record<string, any>;

type MarketingPreview = {
  totals: {
    totalSessions: number;
    avgScore: number;
    bestRole: string | null;
  };
  recent: {
    role: string;
    score: number;
    duration: number;
    date: string;
  }[];
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly rolesService: RolesService,
    private readonly answersService: AnswersService,
    private readonly questionsService: QuestionsService,
    private readonly redis: RedisService,
  ) {}

  /** Matches both string IDs and accidental ObjectId‑typed userId BSON (legacy docs). */
  private userIdClause(userIdRaw: string): SessionsFindArg {
    const id = (userIdRaw ?? '').trim();
    if (!id) {
      return { userId: '__no_user__' };
    }
    if (/^[a-f0-9]{24}$/i.test(id)) {
      return {
        $or: [{ userId: id }, { userId: new Types.ObjectId(id) }],
      };
    }
    return { userId: id };
  }

  private matchUser(
    userId: string,
    extra: SessionsFindArg = {},
  ): SessionsFindArg {
    const clause = this.userIdClause(userId);
    const hasExtra =
      extra !== null &&
      typeof extra === 'object' &&
      Object.keys(extra).length > 0;

    if ('$or' in clause && hasExtra) {
      return { $and: [clause, extra] };
    }

    return hasExtra ? { ...clause, ...extra } : clause;
  }

  async findById(id: string): Promise<SessionDocument | null> {
    return this.sessionModel.findById(id).exec();
  }

  async countByUser(userId: string): Promise<number> {
    return this.sessionModel.countDocuments(this.matchUser(userId)).exec();
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<SessionDocument[]> {
    return this.sessionModel
      .find(this.matchUser(userId))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  async create(sessionData: {
    userId: string;
    roleId: string;
    difficulty: string;
    scheduledBankQuestionIds?: string[];
  }): Promise<SessionDocument> {
    const session = new this.sessionModel(sessionData);
    return session.save();
  }

  async update(
    id: string,
    updateData: {
      status?: 'active' | 'completed';
      score?: number;
      summary?: string;
      topImprovements?: string[];
    },
  ): Promise<SessionDocument | null> {
    const updated = await this.sessionModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (updateData.status === 'completed') {
      await this.redis.delByPattern('aic:marketing:dashboard:*');
    }
    return updated;
  }

  async delete(id: string): Promise<SessionDocument | null> {
    const deleted = await this.sessionModel.findByIdAndDelete(id).exec();
    await this.redis.delByPattern('aic:marketing:dashboard:*');
    return deleted;
  }

  async countAll(): Promise<number> {
    return this.sessionModel.countDocuments().exec();
  }

  /** Newest-first, all users (admin list). */
  async findAllPaginated(page = 1, limit = 20): Promise<SessionDocument[]> {
    const skip = Math.max(0, (page - 1) * limit);
    return this.sessionModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Bank-backed sessions use `scheduledBankQuestionIds`; legacy sessions use
   * per-session Question copies.
   */
  async resolveQuestionsForSession(
    sessionId: string,
    session: SessionDocument,
  ): Promise<QuestionDocument[]> {
    return loadOrderedQuestionsForSession(
      sessionId,
      session,
      this.questionsService,
    );
  }

  async getRecentSessions(
    userId: string,
    limit = 5,
  ): Promise<SessionDocument[]> {
    return this.sessionModel
      .find(this.matchUser(userId))
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getScoreTrend(userId: string, limit = 10): Promise<SessionDocument[]> {
    return this.sessionModel
      .find(this.matchUser(userId, { status: 'completed' }))
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getUserStats(userId: string): Promise<{
    totalSessions: number;
    averageScore: number;
    bestRole: string | null;
    currentStreak: number;
  }> {
    const sessions = await this.sessionModel
      .find(this.matchUser(userId, { status: 'completed' }))
      .exec();

    const totalSessions = sessions.length;
    const averageScore =
      totalSessions > 0
        ? Math.round(
            sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions,
          )
        : 0;

    // Find best performing role
    const roleScores: { [key: string]: number[] } = {};
    sessions.forEach((session) => {
      if (!roleScores[session.roleId]) {
        roleScores[session.roleId] = [];
      }
      roleScores[session.roleId].push(session.score);
    });

    let bestRole: string | null = null;
    let bestAvgScore = 0;
    Object.entries(roleScores).forEach(([roleId, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > bestAvgScore) {
        bestAvgScore = avg;
        bestRole = roleId;
      }
    });

    // Calculate streak (consecutive days with at least one session)
    const currentStreak = await this.calculateCurrentStreak(userId);

    return {
      totalSessions,
      averageScore,
      bestRole,
      currentStreak,
    };
  }

  private async calculateCurrentStreak(userId: string): Promise<number> {
    const sessions = await this.sessionModel
      .find(this.matchUser(userId, { status: 'completed' }))
      .sort({ createdAt: -1 })
      .exec();

    if (sessions.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const session of sessions) {
      if (!session.createdAt) continue;

      const sessionDate = new Date(session.createdAt);
      sessionDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff === streak) {
        streak++;
        currentDate = sessionDate;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Anonymous-safe aggregates + recent completed rows (no user ids) for the
   * marketing homepage dashboard mock.
   */
  async getPublicLandingDashboardPreview(
    limitRecent = 3,
  ): Promise<MarketingPreview> {
    const cap = Math.min(10, Math.max(1, limitRecent));
    const key = CacheKeys.marketingDashboard(cap);
    const cached = await this.redis.getJson<MarketingPreview>(key);
    if (cached) return cached;

    const completedMatch = { status: 'completed' as const };

    const [totalSessions, avgAgg, roleAgg, recentDocs, allRoles] =
      await Promise.all([
        this.sessionModel.countDocuments(completedMatch).exec(),
        this.sessionModel
          .aggregate<{
            avgScore: number | null;
          }>([
            { $match: completedMatch },
            { $group: { _id: null, avgScore: { $avg: '$score' } } },
          ])
          .exec(),
        this.sessionModel
          .aggregate<{
            _id: string;
            avgScore: number;
          }>([
            { $match: completedMatch },
            { $group: { _id: '$roleId', avgScore: { $avg: '$score' } } },
            { $sort: { avgScore: -1 } },
            { $limit: 1 },
          ])
          .exec(),
        this.sessionModel
          .find(completedMatch)
          .sort({ updatedAt: -1 })
          .limit(cap)
          .exec(),
        this.rolesService.findAll(),
      ]);

    const averageScore =
      avgAgg[0]?.avgScore != null ? Math.round(Number(avgAgg[0].avgScore)) : 0;

    const roleNames = buildRoleNameMap(allRoles);
    const bestRoleId =
      roleAgg[0]?._id != null ? String(roleAgg[0]._id).trim() : '';
    const bestRoleLabel =
      bestRoleId && (roleNames.get(bestRoleId)?.trim() || '')
        ? roleNames.get(bestRoleId)!.trim()
        : bestRoleId
          ? 'Unknown'
          : null;

    const recent = recentDocs.map((s) => {
      const row = summarizeSessionForListRow(s, roleNames);
      return {
        role: row.role,
        score: row.score,
        duration: row.duration,
        date: row.date,
      };
    });

    const payload: MarketingPreview = {
      totals: {
        totalSessions,
        avgScore: averageScore,
        bestRole: totalSessions === 0 ? null : bestRoleLabel,
      },
      recent,
    };

    await this.redis.setJson(key, payload, CacheTtlSeconds.marketing);
    return payload;
  }

  /** Removes all interview sessions, answers, and per-session questions for a Better Auth user id. */
  async deleteAllInterviewDataForUser(authUserId: string): Promise<void> {
    const filter = this.matchUser(authUserId);
    const sessions = await this.sessionModel
      .find(filter)
      .select('_id')
      .lean()
      .exec();
    for (const s of sessions) {
      const id = String(s._id);
      await this.answersService.deleteBySession(id);
      await this.questionsService.deleteBySession(id);
    }
    await this.sessionModel.deleteMany(filter).exec();
  }
}
