import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Answer, AnswerDocument } from './answer.schema';

@Injectable()
export class AnswersService implements OnModuleInit {
  constructor(
    @InjectModel(Answer.name)
    private readonly answerModel: Model<AnswerDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Do not serve submissions until the database uniqueness constraint exists.
    // Existing duplicate data must be migrated before starting this version.
    await this.answerModel.createIndexes();
  }

  async findBySession(sessionId: string): Promise<AnswerDocument[]> {
    const rows = await this.answerModel
      .find({ sessionId })
      .sort({ createdAt: 1, _id: 1 })
      .exec();
    // Defensive handling of legacy duplicates until the explicit migration runs.
    const firstByQuestion = new Map<string, AnswerDocument>();
    for (const answer of rows) {
      if (!firstByQuestion.has(answer.questionId))
        firstByQuestion.set(answer.questionId, answer);
    }
    return [...firstByQuestion.values()];
  }

  async findByQuestion(questionId: string): Promise<AnswerDocument[]> {
    return this.answerModel.find({ questionId }).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<AnswerDocument | null> {
    return this.answerModel.findById(id).exec();
  }

  async findBySessionQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<AnswerDocument | null> {
    return this.answerModel
      .findOne({ sessionId, questionId })
      .sort({ createdAt: 1, _id: 1 })
      .exec();
  }

  assertSameTranscript(answer: AnswerDocument, transcript: string): void {
    if (answer.transcript.trim() !== transcript.trim()) {
      throw new ConflictException('This question has already been answered');
    }
  }

  async create(answerData: {
    sessionId: string;
    questionId: string;
    transcript: string;
    feedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
    evaluationSource?: 'llm' | 'heuristic_fallback';
  }): Promise<AnswerDocument> {
    const filter = {
      sessionId: answerData.sessionId,
      questionId: answerData.questionId,
    };
    let answer: AnswerDocument | null;
    try {
      answer = await this.answerModel
        .findOneAndUpdate(
          filter,
          {
            $setOnInsert: { ...answerData, userAnswer: answerData.transcript },
          },
          { upsert: true, new: true, runValidators: true },
        )
        .exec();
    } catch (error: unknown) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      answer = await this.findBySessionQuestion(
        filter.sessionId,
        filter.questionId,
      );
    }
    if (!answer) throw new Error('Answer persistence failed');
    this.assertSameTranscript(answer, answerData.transcript);
    return answer;
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
