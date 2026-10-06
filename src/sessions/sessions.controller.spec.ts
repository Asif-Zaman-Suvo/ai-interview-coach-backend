jest.mock('../auth/auth.guard', () => ({ AuthGuard: class AuthGuard {} }));
import { SessionsController } from './sessions.controller';
import { InterviewEvaluationService } from './interview-evaluation.service';
import { HeuristicEvaluationService } from './heuristic-evaluation.service';
import { SessionPayloadService } from './session-payload.service';
import { QuestionGenerationService } from './question-generation.service';
import { profile } from '../../test/fixtures/resume-profile.fixture';
const roleId = '6a05ae0156de6aad7e6a701f';
const resumeId = '6ac38d37172d31d72f563feb';
describe('learner interview endpoints', () => {
  const question = {
    _id: 'q',
    text: 'Question',
    idealAnswer: 'PRIVATE REFERENCE',
    type: 'technical',
    difficulty: 'Easy',
    roleId,
  };
  const session = {
    _id: 's',
    userId: 'u',
    roleId: 'r',
    difficulty: 'Easy',
    status: 'active',
    scheduledBankQuestionIds: ['q'],
    topImprovements: [],
    createdAt: new Date(),
  };
  const saved = {
    questionId: 'q',
    transcript: 'Answer',
    score: 80,
    feedback: 'Good',
    strengths: [],
    improvements: [],
    evaluationSource: 'llm',
  };
  const req = { user: { id: 'u', email: 'u@example.com' } };
  type MockMethods = Record<string, jest.Mock>;
  type Dependencies = ConstructorParameters<typeof SessionsController>;
  let sessions: MockMethods,
    questions: MockMethods,
    answers: MockMethods,
    roles: MockMethods,
    evaluator: MockMethods,
    resumes: MockMethods,
    controller: SessionsController;
  beforeEach(() => {
    sessions = {
      findById: jest.fn().mockResolvedValue({ ...session }),
      create: jest.fn().mockResolvedValue(session),
      completeIfActive: jest
        .fn()
        .mockImplementation((_id: string, result: Record<string, unknown>) =>
          Promise.resolve({ ...session, status: 'completed', ...result }),
        ),
    };
    questions = {
      findById: jest.fn().mockResolvedValue(question),
      findByIdsPreserveOrder: jest.fn().mockResolvedValue([question]),
      findBankByRoleAndDifficulty: jest.fn().mockResolvedValue([question]),
    };
    answers = {
      findBySessionQuestion: jest.fn().mockResolvedValue(null),
      assertSameTranscript: jest.fn(),
      create: jest.fn().mockResolvedValue(saved),
      findBySession: jest.fn().mockResolvedValue([saved]),
    };
    roles = {
      findById: jest.fn().mockResolvedValue({ name: 'Backend Developer' }),
    };
    evaluator = {
      summarizeSession: jest.fn().mockResolvedValue({
        summary: 'Personalized summary',
        topImprovements: ['Practice trade-offs'],
        summarySource: 'llm',
      }),
      evaluateAnswer: jest.fn().mockResolvedValue({
        score: 80,
        feedback: 'Good',
        strengths: [],
        improvements: [],
        evaluationSource: 'llm',
      }),
    };
    const users = {
      createProfileIfAbsent: jest.fn(),
      getRoleForEmail: jest.fn().mockResolvedValue('admin'),
    };
    resumes = {
      getConfirmedInterviewContext: jest.fn().mockResolvedValue({
        reviewedProfile: profile,
        privateResumeContext: 'PRIVATE CV',
      }),
    };
    const generation = new QuestionGenerationService({
      generateStructured: jest.fn(),
    });
    jest.spyOn(generation, 'generate').mockResolvedValue({
      questions: [
        generation.snapshotBank(
          question as unknown as Parameters<typeof generation.snapshotBank>[0],
        ),
      ],
      mode: 'personalized_hybrid',
    });
    controller = new SessionsController(
      sessions as unknown as Dependencies[0],
      {} as Dependencies[1],
      questions as unknown as Dependencies[2],
      answers as unknown as Dependencies[3],
      roles as unknown as Dependencies[4],
      evaluator as unknown as Dependencies[5],
      users as unknown as Dependencies[6],
      resumes as unknown as Dependencies[7],
      generation,
    );
  });
  it('validates resume ownership and confirmed settings before linking the session', async () => {
    await controller.startSession(
      { roleId, difficulty: 'Easy', resumeId },
      req as unknown as Parameters<SessionsController['startSession']>[1],
    );
    expect(resumes.getConfirmedInterviewContext).toHaveBeenCalledWith(
      resumeId,
      'u',
      roleId,
      'Easy',
    );
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId }),
    );
  });
  it('does not create a session when resume ownership or confirmation fails', async () => {
    resumes.getConfirmedInterviewContext.mockRejectedValue(
      new Error('Resume not found'),
    );
    await expect(
      controller.startSession(
        { roleId, difficulty: 'Easy', resumeId },
        req as unknown as Parameters<SessionsController['startSession']>[1],
      ),
    ).rejects.toThrow('Resume not found');
    expect(sessions.create).not.toHaveBeenCalled();
  });
  it('loads all private context and omits metadata from answer response', async () => {
    const response = await controller.submitAnswer(
      's',
      { questionId: 'q', transcript: 'Answer' },
      req as unknown as Parameters<SessionsController['submitAnswer']>[2],
    );
    expect(evaluator.evaluateAnswer).toHaveBeenCalledWith({
      question: question.text,
      idealAnswer: question.idealAnswer,
      transcript: 'Answer',
      role: 'Backend Developer',
      difficulty: 'Easy',
      questionType: 'technical',
    });
    expect(response).not.toHaveProperty('evaluationSource');
    expect(JSON.stringify(response)).not.toContain('idealAnswer');
  });
  it('replays saved answers without evaluation or persistence', async () => {
    answers.findBySessionQuestion.mockResolvedValue(saved);
    await controller.submitAnswer(
      's',
      { questionId: 'q', transcript: 'Answer' },
      req as unknown as Parameters<SessionsController['submitAnswer']>[2],
    );
    expect(evaluator.evaluateAnswer).not.toHaveBeenCalled();
    expect(answers.create).not.toHaveBeenCalled();
  });
  it('rejects completed sessions even for duplicate submissions', async () => {
    sessions.findById.mockResolvedValue({ ...session, status: 'completed' });
    await expect(
      controller.submitAnswer(
        's',
        { questionId: 'q', transcript: 'Answer' },
        req as unknown as Parameters<SessionsController['submitAnswer']>[2],
      ),
    ).rejects.toThrow('completed session');
    expect(evaluator.evaluateAnswer).not.toHaveBeenCalled();
    expect(answers.create).not.toHaveBeenCalled();
  });
  it('rejects persistence if completed while evaluation was running', async () => {
    sessions.findById
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ ...session, status: 'completed' });
    await expect(
      controller.submitAnswer(
        's',
        { questionId: 'q', transcript: 'Answer' },
        req as unknown as Parameters<SessionsController['submitAnswer']>[2],
      ),
    ).rejects.toThrow('completed session');
    expect(answers.create).not.toHaveBeenCalled();
  });
  it('omits ideal answers from start and detail responses', async () => {
    const start = await controller.startSession(
      { roleId, difficulty: 'Easy' },
      req as unknown as Parameters<SessionsController['submitAnswer']>[2],
    );
    const mapper = new SessionPayloadService(
      sessions as unknown as Dependencies[0],
      answers as unknown as Dependencies[3],
      roles as unknown as Dependencies[4],
      questions as unknown as Dependencies[2],
    );
    const detail = await mapper.assembleSessionPayload('s');
    expect(JSON.stringify({ start, detail })).not.toContain('idealAnswer');
    expect(JSON.stringify({ start, detail })).not.toContain(
      'PRIVATE REFERENCE',
    );
  });
  it('omits ideal answers from next-question responses', async () => {
    questions.findByIdsPreserveOrder.mockResolvedValue([
      question,
      { ...question, _id: 'q2' },
    ]);
    const response = await controller.submitAnswer(
      's',
      { questionId: 'q', transcript: 'Answer' },
      req as unknown as Parameters<SessionsController['submitAnswer']>[2],
    );
    expect(response.nextQuestion?.id).toBe('q2');
    expect(JSON.stringify(response)).not.toContain('idealAnswer');
  });
  it('persists a private-source summary and returns only public completion fields', async () => {
    const result = await controller.completeSession(
      's',
      req as unknown as Parameters<SessionsController['completeSession']>[1],
    );
    expect(result).toEqual({
      finalScore: 80,
      summary: 'Personalized summary',
      topImprovements: ['Practice trade-offs'],
    });
    expect(sessions.completeIfActive).toHaveBeenCalledWith('s', {
      score: 80,
      summary: 'Personalized summary',
      topImprovements: ['Practice trade-offs'],
      summarySource: 'llm',
    });
    expect(evaluator.summarizeSession).toHaveBeenCalledWith({
      role: 'Backend Developer',
      difficulty: 'Easy',
      answers: [
        {
          question: 'Question',
          questionType: 'technical',
          transcript: 'Answer',
          score: 80,
          feedback: 'Good',
          strengths: [],
          improvements: [],
        },
      ],
    });
    const context = (
      evaluator.summarizeSession.mock.calls as unknown[][]
    )[0][0];
    expect(JSON.stringify(context)).not.toContain('PRIVATE REFERENCE');
    expect(JSON.stringify(result)).not.toMatch(
      /summarySource|evaluationSource|provider|idealAnswer/,
    );
  });
  it('replays completed sessions without generating or overwriting a summary', async () => {
    sessions.findById.mockResolvedValue({
      ...session,
      status: 'completed',
      score: 75,
      summary: 'Saved summary',
      topImprovements: ['Saved priority'],
      summarySource: 'llm',
    });
    const result = await controller.completeSession(
      's',
      req as unknown as Parameters<SessionsController['completeSession']>[1],
    );
    expect(result.summary).toBe('Saved summary');
    expect(evaluator.summarizeSession).not.toHaveBeenCalled();
    expect(sessions.completeIfActive).not.toHaveBeenCalled();
    expect(answers.findBySession).not.toHaveBeenCalled();
  });
  it('coalesces overlapping completion requests', async () => {
    const results = await Promise.all([
      controller.completeSession(
        's',
        req as unknown as Parameters<SessionsController['completeSession']>[1],
      ),
      controller.completeSession(
        's',
        req as unknown as Parameters<SessionsController['completeSession']>[1],
      ),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(evaluator.summarizeSession).toHaveBeenCalledTimes(1);
    expect(sessions.completeIfActive).toHaveBeenCalledTimes(1);
  });
  it('completion still succeeds and persists fallback when the provider fails', async () => {
    const failedProvider = {
      generateStructured: jest
        .fn()
        .mockRejectedValue(new Error('provider_timeout')),
    };
    const realEvaluator = new InterviewEvaluationService(
      failedProvider,
      new HeuristicEvaluationService(),
    );
    const deps = [
      sessions,
      {},
      questions,
      answers,
      roles,
      realEvaluator,
      {},
    ] as unknown as Dependencies;
    const fallbackController = new SessionsController(...deps);
    const result = await fallbackController.completeSession(
      's',
      req as unknown as Parameters<SessionsController['completeSession']>[1],
    );
    expect(result.finalScore).toBe(80);
    expect(result.summary).toContain('Average score 80/100');
    expect(
      (sessions.completeIfActive.mock.calls as unknown[][])[0][1],
    ).toHaveProperty('summarySource', 'heuristic_fallback');
    expect(result).not.toHaveProperty('summarySource');
  });
  it('detail payload includes persisted summaries while hiding internal metadata', async () => {
    sessions.findById.mockResolvedValue({
      ...session,
      status: 'completed',
      summary: 'Saved summary',
      topImprovements: ['Priority'],
      summarySource: 'llm',
    });
    const mapper = new SessionPayloadService(
      sessions as unknown as Dependencies[0],
      answers as unknown as Dependencies[3],
      roles as unknown as Dependencies[4],
      questions as unknown as Dependencies[2],
    );
    const result = await mapper.assembleSessionPayload('s');
    expect(result?.summary).toBe('Saved summary');
    expect(result?.topImprovements).toEqual(['Priority']);
    expect(result).not.toHaveProperty('summarySource');
    expect(JSON.stringify(result)).not.toMatch(
      /idealAnswer|evaluationSource|provider/,
    );
  });
});
