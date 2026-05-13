import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question, QuestionDocument } from './question.schema';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
  ) {}

  async findBySession(sessionId: string): Promise<Question[]> {
    return this.questionModel.find({ sessionId }).sort({ createdAt: 1 }).exec();
  }

  async findById(id: string): Promise<Question | null> {
    return this.questionModel.findById(id).exec();
  }

  async create(questionData: {
    sessionId: string;
    roleId: string;
    text: string;
    idealAnswer: string;
    type: 'technical' | 'behavioral';
    difficulty: string;
  }): Promise<Question> {
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
  ): Promise<Question | null> {
    return this.questionModel
      .findByIdAndUpdate(id, questionData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<Question | null> {
    return this.questionModel.findByIdAndDelete(id).exec();
  }

  async deleteBySession(sessionId: string): Promise<any> {
    return this.questionModel.deleteMany({ sessionId }).exec();
  }
}
