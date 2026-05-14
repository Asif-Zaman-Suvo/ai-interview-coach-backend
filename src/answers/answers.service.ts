import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Answer, AnswerDocument } from './answer.schema';

@Injectable()
export class AnswersService {
  constructor(
    @InjectModel(Answer.name)
    private readonly answerModel: Model<AnswerDocument>,
  ) {}

  async findBySession(sessionId: string): Promise<AnswerDocument[]> {
    return this.answerModel.find({ sessionId }).sort({ createdAt: 1 }).exec();
  }

  async findByQuestion(questionId: string): Promise<AnswerDocument[]> {
    return this.answerModel.find({ questionId }).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<AnswerDocument | null> {
    return this.answerModel.findById(id).exec();
  }

  async create(answerData: {
    sessionId: string;
    questionId: string;
    transcript: string;
    feedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
  }): Promise<AnswerDocument> {
    const answer = new this.answerModel(answerData);
    return answer.save();
  }

  async calculateAverageScore(sessionId: string): Promise<number> {
    const answers = await this.findBySession(sessionId);
    if (answers.length === 0) return 0;

    const total = answers.reduce((sum, answer) => sum + answer.score, 0);
    return Math.round(total / answers.length);
  }

  async deleteBySession(sessionId: string): Promise<any> {
    return this.answerModel.deleteMany({ sessionId }).exec();
  }
}
