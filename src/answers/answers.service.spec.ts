import { AnswersService } from './answers.service';
import type { AnswerDocument } from './answer.schema';
import { AnswerSchema } from './answer.schema';
describe('AnswersService', () => {
  const saved = {
    sessionId: 's',
    questionId: 'q',
    transcript: 'answer',
    score: 80,
  };
  const data = {
    ...saved,
    feedback: 'Good',
    strengths: [],
    improvements: [],
    evaluationSource: 'llm' as const,
  };
  it('defines compound uniqueness', () => {
    expect(AnswerSchema.indexes()).toContainEqual([
      { sessionId: 1, questionId: 1 },
      { unique: true },
    ]);
  });
  it('uses insert-only upsert and returns the persisted winner', async () => {
    const model = {
      findOneAndUpdate: jest
        .fn<unknown, [unknown, unknown, unknown]>()
        .mockReturnValue({ exec: () => Promise.resolve(saved) }),
    };
    const service = new AnswersService(
      model as unknown as ConstructorParameters<typeof AnswersService>[0],
    );
    expect(await service.create(data)).toBe(saved);
    expect(model.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $setOnInsert: { ...data, userAnswer: 'answer' },
    });
  });
  it('recovers a concurrent unique-index collision', async () => {
    const service = new AnswersService({
      findOneAndUpdate: () => ({
        exec: () =>
          Promise.reject(
            Object.assign(new Error('duplicate'), { code: 11000 }),
          ),
      }),
    } as unknown as ConstructorParameters<typeof AnswersService>[0]);
    jest
      .spyOn(service, 'findBySessionQuestion')
      .mockResolvedValue(saved as unknown as AnswerDocument);
    expect(await service.create(data)).toBe(saved);
  });
  it('rejects different transcripts for the same question', async () => {
    const service = new AnswersService({
      findOneAndUpdate: () => ({ exec: () => Promise.resolve(saved) }),
    } as unknown as ConstructorParameters<typeof AnswersService>[0]);
    await expect(
      service.create({ ...data, transcript: 'changed' }),
    ).rejects.toThrow('already been answered');
  });
  it('averages only the earliest answer per question for legacy data', async () => {
    const rows = [
      saved,
      { ...saved, score: 100 },
      { ...saved, questionId: 'q2', score: 60 },
    ];
    const service = new AnswersService({
      find: () => ({ sort: () => ({ exec: () => Promise.resolve(rows) }) }),
    } as unknown as ConstructorParameters<typeof AnswersService>[0]);
    expect(await service.calculateAverageScore('s')).toBe(70);
  });
});
