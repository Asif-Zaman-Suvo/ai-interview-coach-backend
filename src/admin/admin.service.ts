import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Session, SessionDocument } from '../sessions/session.schema';
import { Question, QuestionDocument } from '../questions/question.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
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

  async createQuestion(questionData: {
    roleId: string;
    text: string;
    idealAnswer: string;
    type: 'technical' | 'behavioral';
    difficulty: string;
  }): Promise<Question> {
    const question = new this.questionModel({
      ...questionData,
      sessionId: 'admin-manual',
    });
    return question.save();
  }

  async updateQuestion(
    questionId: string,
    questionData: {
      text?: string;
      idealAnswer?: string;
      type?: 'technical' | 'behavioral';
      difficulty?: string;
    },
  ): Promise<Question | null> {
    return this.questionModel
      .findByIdAndUpdate(questionId, questionData, { new: true })
      .exec();
  }

  async deleteQuestion(questionId: string): Promise<Question | null> {
    return this.questionModel.findByIdAndDelete(questionId).exec();
  }
}
