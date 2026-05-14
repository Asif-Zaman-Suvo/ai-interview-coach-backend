import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './session.schema';

/** Mongo filters for interviews (DSL values are intentionally loose vs schema typing). */
type SessionsFindArg = Record<string, any>;

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
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
      Object.keys(extra as object).length > 0;

    if ('$or' in clause && hasExtra) {
      return { $and: [clause, extra] } as SessionsFindArg;
    }

    return hasExtra
      ? ({ ...clause, ...extra } as SessionsFindArg)
      : clause;
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
    return this.sessionModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<SessionDocument | null> {
    return this.sessionModel.findByIdAndDelete(id).exec();
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

  async getScoreTrend(
    userId: string,
    limit = 10,
  ): Promise<SessionDocument[]> {
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
}
