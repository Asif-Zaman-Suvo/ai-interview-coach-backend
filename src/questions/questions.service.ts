import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question, QuestionDocument, type Difficulty } from './question.schema';
import { QUESTION_BANK_SESSION_IDS } from './question-bank.constants';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
  ) {}

  async findBySession(sessionId: string): Promise<QuestionDocument[]> {
    return this.questionModel.find({ sessionId }).sort({ createdAt: 1 }).exec();
  }

  async findById(id: string): Promise<QuestionDocument | null> {
    return this.questionModel.findById(id).exec();
  }

  async create(questionData: {
    sessionId: string;
    roleId: string;
    text: string;
    idealAnswer: string;
    type: 'technical' | 'behavioral';
    difficulty: string;
  }): Promise<QuestionDocument> {
    const question = new this.questionModel(questionData);
    return question.save();
  }

  async createMany(questions: any[]): Promise<any[]> {
    return this.questionModel.insertMany(questions);
  }

  async update(
    id: string,
    questionData: {
      text?: string;
      idealAnswer?: string;
      type?: 'technical' | 'behavioral';
      difficulty?: string;
    },
  ): Promise<QuestionDocument | null> {
    return this.questionModel
      .findByIdAndUpdate(id, questionData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<QuestionDocument | null> {
    return this.questionModel.findByIdAndDelete(id).exec();
  }

  async deleteBySession(sessionId: string): Promise<any> {
    return this.questionModel.deleteMany({ sessionId }).exec();
  }

  bankFilter(): Record<string, unknown> {
    return { sessionId: { $in: [...QUESTION_BANK_SESSION_IDS] } };
  }

  async findBankByRoleAndDifficulty(
    roleId: string,
    difficulty: string,
  ): Promise<QuestionDocument[]> {
    return this.questionModel
      .find({
        ...this.bankFilter(),
        roleId,
        difficulty: difficulty as Difficulty,
      })
      .exec();
  }

  async findAllBank(): Promise<QuestionDocument[]> {
    return this.questionModel
      .find(this.bankFilter())
      .sort({ updatedAt: -1 })
      .exec();
  }
}
