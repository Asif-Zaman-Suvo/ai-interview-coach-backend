import { Logger } from '@nestjs/common';
import type { StructuredRequest } from '../llm/llm-provider.interface';
import { InterviewEvaluationService } from './interview-evaluation.service';
import { HeuristicEvaluationService } from './heuristic-evaluation.service';
const input = {
  question: 'Explain caching',
  idealAnswer: 'Cache repeated reads',
  transcript: 'Cache repeated reads with expiration',
  role: 'Backend Developer',
  difficulty: 'Medium',
  questionType: 'technical',
};
const output = {
  score: 82,
  feedback: 'Good explanation',
  strengths: ['Relevant example'],
  improvements: ['Explain invalidation'],
};
describe('InterviewEvaluationService', () => {
  const generateStructured = jest.fn<Promise<unknown>, [StructuredRequest]>();
  const service = new InterviewEvaluationService(
    { generateStructured },
    new HeuristicEvaluationService(),
  );
  beforeEach(() => generateStructured.mockReset());
  it('validates output and supplies all evaluation context', async () => {
    generateStructured.mockResolvedValue(output);
    expect(await service.evaluateAnswer(input)).toEqual({
      ...output,
      evaluationSource: 'llm',
    });
    expect(generateStructured.mock.calls[0][0].context).toEqual(input);
  });
  it.each([
    null,
    'not JSON',
    { ...output, score: 101 },
    { ...output, score: '82' },
    { ...output, feedback: ' ' },
    { ...output, strengths: [4] },
    { ...output, extra: true },
  ])('falls back for invalid output %j', async (value) => {
    generateStructured.mockResolvedValue(value);
    const result = await service.evaluateAnswer(input);
    expect(result.evaluationSource).toBe('heuristic_fallback');
    expect(result.feedback).toContain('AI evaluation was unavailable');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
  it.each([
    ['provider_http_error:429', 'provider_http_error:429'],
    ['provider_output_limit', 'provider_output_limit'],
    ['PRIVATE ANSWER / IDEAL ANSWER / API KEY / RESPONSE', 'unknown_error'],
  ])('logs only a safe failure category', async (message, category) => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      generateStructured.mockRejectedValue(new Error(message));
      expect((await service.evaluateAnswer(input)).evaluationSource).toBe(
        'heuristic_fallback',
      );
      expect(warn).toHaveBeenCalledWith(
        `LLM evaluation unavailable [${category}]; using heuristic fallback`,
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE');
    } finally {
      warn.mockRestore();
    }
  });
  it('falls back on provider errors', async () => {
    generateStructured.mockRejectedValue(new Error('provider_timeout'));
    expect((await service.evaluateAnswer(input)).evaluationSource).toBe(
      'heuristic_fallback',
    );
  });
});

describe('LLM session summary', () => {
  const input = {
    role: 'Backend Developer',
    difficulty: 'Medium',
    answers: [
      {
        question: 'Explain caching',
        questionType: 'technical',
        transcript: 'Cache reads and expire entries',
        score: 82,
        feedback: 'Relevant example; explain invalidation',
        strengths: ['Concrete example'],
        improvements: ['Discuss invalidation'],
      },
    ],
  };
  const output = {
    summary:
      'Your caching example was clear; deepen the discussion of invalidation.',
    topImprovements: [
      'Compare invalidation strategies using one concrete scenario.',
    ],
  };
  const provider = {
    generateStructured: jest.fn<Promise<unknown>, [StructuredRequest]>(),
  };
  const service = new InterviewEvaluationService(
    provider,
    new HeuristicEvaluationService(),
  );
  beforeEach(() => provider.generateStructured.mockReset());
  it('generates a validated summary through the shared provider without reference answers', async () => {
    provider.generateStructured.mockResolvedValue(output);
    expect(await service.summarizeSession(input)).toEqual({
      ...output,
      summarySource: 'llm',
    });
    const request = provider.generateStructured.mock.calls[0][0];
    expect(request.context).toEqual(input);
    expect(request.schemaName).toBe('interview_session_summary');
    expect(JSON.stringify(request.context)).not.toContain('idealAnswer');
  });
  it.each([
    'broken JSON',
    { summary: 'Missing priorities' },
    { ...output, topImprovements: [false] },
  ])('uses deterministic fallback for malformed output %j', async (value) => {
    provider.generateStructured.mockResolvedValue(value);
    const result = await service.summarizeSession(input);
    const expected = new HeuristicEvaluationService().summarizeSession(
      [82],
      [input.answers[0].feedback],
    );
    expect(result).toEqual({
      ...expected,
      summarySource: 'heuristic_fallback',
    });
  });
  it.each(['provider_timeout', 'provider_network_error'])(
    'uses fallback for %s',
    async (reason) => {
      provider.generateStructured.mockRejectedValue(new Error(reason));
      expect((await service.summarizeSession(input)).summarySource).toBe(
        'heuristic_fallback',
      );
    },
  );
  it('does not invent personalized evidence when there are no answers', async () => {
    const result = await service.summarizeSession({ ...input, answers: [] });
    expect(result.summary).toContain('No answers');
    expect(result.topImprovements).toEqual([]);
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });
});
