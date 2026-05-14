import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Session, SessionDocument } from '../sessions/session.schema';
import { RolesService } from '../roles/roles.service';
import { QuestionsService } from '../questions/questions.service';
import { PRIMARY_QUESTION_BANK_SESSION_ID } from '../questions/question-bank.constants';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly rolesService: RolesService,
    private readonly questionsService: QuestionsService,
  ) {}

  async getAllUsers(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalSessions: number;
    averageScore: number;
    activeToday: number;
  }> {
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
    return this.userModel
      .findByIdAndUpdate(userId, { role }, { new: true })
      .exec();
  }

  async deleteUser(userId: string): Promise<User | null> {
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