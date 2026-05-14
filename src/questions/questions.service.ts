import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  /** Loads bank/session question docs matching `ids`, keeping caller order (skips missing). */
  async findByIdsPreserveOrder(ids: string[]): Promise<QuestionDocument[]> {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) return [];
    const docs = await this.questionModel
      .find({ _id: { $in: objectIds } })
      .exec();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const out: QuestionDocument[] = [];
    for (const id of ids) {
      const doc = byId.get(id);
      if (doc) out.push(doc);
    }
    return out;
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
