import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument, type Difficulty } from './question.schema';
import { QUESTION_BANK_SESSION_IDS } from './question-bank.constants';
import { RedisService } from '../redis/redis.service';
import { CacheKeys, CacheTtlSeconds } from '../redis/cache-keys';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
    private readonly redis: RedisService,
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
    const saved = await question.save();
    await this.invalidateBankCache();
    return saved;
  }

  async createMany(
    questions: Record<string, unknown>[],
  ): Promise<QuestionDocument[]> {
    const inserted = await this.questionModel.insertMany(questions);
    await this.invalidateBankCache();
    return inserted as unknown as QuestionDocument[];
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
    const updated = await this.questionModel
      .findByIdAndUpdate(id, questionData, { new: true })
      .exec();
    await this.invalidateBankCache();
    return updated;
  }

  async delete(id: string): Promise<QuestionDocument | null> {
    const deleted = await this.questionModel.findByIdAndDelete(id).exec();
    await this.invalidateBankCache();
    return deleted;
  }

  async deleteBySession(sessionId: string): Promise<{ deletedCount?: number }> {
    const result = await this.questionModel.deleteMany({ sessionId }).exec();
    await this.invalidateBankCache();
    return result;
  }

  bankFilter(): Record<string, unknown> {
    return { sessionId: { $in: [...QUESTION_BANK_SESSION_IDS] } };
  }

  async findBankByRoleAndDifficulty(
    roleId: string,
    difficulty: string,
  ): Promise<QuestionDocument[]> {
    const key = CacheKeys.questionsBankByRoleDifficulty(roleId, difficulty);
    const cached = await this.redis.getJson<Record<string, unknown>[]>(key);
    if (cached) {
      return cached.map((raw) => this.questionModel.hydrate(raw));
    }

    const docs = await this.questionModel
      .find({
        ...this.bankFilter(),
        roleId,
        difficulty: difficulty as Difficulty,
      })
      .exec();

    await this.redis.setJson(
      key,
      docs.map((d) => d.toObject()),
      CacheTtlSeconds.questions,
    );
    return docs;
  }

  async findAllBank(): Promise<QuestionDocument[]> {
    const key = CacheKeys.questionsBank();
    const cached = await this.redis.getJson<Record<string, unknown>[]>(key);
    if (cached) {
      return cached.map((raw) => this.questionModel.hydrate(raw));
    }

    const docs = await this.questionModel
      .find(this.bankFilter())
      .sort({ updatedAt: -1 })
      .exec();

    await this.redis.setJson(
      key,
      docs.map((d) => d.toObject()),
      CacheTtlSeconds.questions,
    );
    return docs;
  }

  private async invalidateBankCache(): Promise<void> {
    await this.redis.delByPattern('aic:questions:bank:*');
  }
}
