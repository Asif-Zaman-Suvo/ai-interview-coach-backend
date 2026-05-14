import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './session.schema';

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async findById(id: string): Promise<SessionDocument | null> {
    return this.sessionModel.findById(id).exec();
  }

  async countByUser(userId: string): Promise<number> {
    return this.sessionModel.countDocuments({ userId }).exec();
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  async create(sessionData: {
    userId: string;
    roleId: string;
    difficulty: string;
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
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getScoreTrend(
    userId: string,
    limit = 10,
  ): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({ userId, status: 'completed' })
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
      .find({ userId, status: 'completed' })
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
      .find({ userId, status: 'completed' })
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
