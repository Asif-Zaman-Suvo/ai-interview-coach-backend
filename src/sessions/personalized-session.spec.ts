jest.mock('../auth/auth.guard', () => ({ AuthGuard: class AuthGuard {} }));
import { Types, model } from 'mongoose';
import { SessionsController } from './sessions.controller';
import { SessionPayloadService } from './session-payload.service';
import { QuestionGenerationService } from './question-generation.service';
import { InterviewEvaluationService } from './interview-evaluation.service';
import { HeuristicEvaluationService } from './heuristic-evaluation.service';
import type { EvaluationInput } from './evaluation.contract';
import { Session, SessionSchema } from './session.schema';
import { loadOrderedQuestionsForSession } from './session-questions.util';
import { profile } from '../../test/fixtures/resume-profile.fixture';
import {
  additionalRoleQuestion,
  bankQuestions,
  generatedQuestions,
} from '../../test/fixtures/generated-questions.fixture';

const SessionModel = model<Session>('PersonalizedSessionTest', SessionSchema);
type Deps = ConstructorParameters<typeof SessionsController>;
type Mocks = Record<string, jest.Mock>;
const roleId = '6a05ae0156de6aad7e6a701f';
const resumeId = '6ac38d37172d31d72f563feb';
const request = {
  user: { id: 'owner', email: 'owner@example.test', role: 'learner' },
} as Parameters<SessionsController['startSession']>[1];
describe('stable learner-safe personalized sessions', () => {
  let sessions: Mocks,
    bank: Mocks,
    answers: Mocks,
    resumes: Mocks,
    evaluator: Mocks;
  let generator: QuestionGenerationService,
    provider: { generateStructured: jest.Mock },
    controller: SessionsController;
  let stored: ReturnType<typeof SessionModel.hydrate>;
  let payload: SessionPayloadService;
  beforeEach(() => {
    provider = {
      generateStructured: jest
        .fn()
        .mockResolvedValue({ questions: generatedQuestions }),
    };
    generator = new QuestionGenerationService(provider);
    sessions = {
      create: jest.fn().mockImplementation(async (data: object) => {
        const doc = new SessionModel(data);
        await doc.validate();
        // Rehydrate a serialized document to simulate reading persistence after a restart.
        stored = SessionModel.hydrate(
          JSON.parse(JSON.stringify(doc.toObject())) as Record<string, unknown>,
        );
        stored.createdAt = new Date();
        stored.updatedAt = stored.createdAt;
        return stored;
      }),
      findById: jest.fn().mockImplementation(() => Promise.resolve(stored)),
    };
    bank = {
      findBankByRoleAndDifficulty: jest
        .fn()
        .mockResolvedValue(bankQuestions(roleId, 'Hard').slice(0, 1)),
      findById: jest.fn(),
      findByIdsPreserveOrder: jest.fn(),
      findBySession: jest.fn(),
    };
    answers = {
      findBySessionQuestion: jest.fn().mockResolvedValue(null),
      findBySession: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation((answer: object) => Promise.resolve(answer)),
    };
    resumes = {
      getConfirmedInterviewContext: jest.fn().mockResolvedValue({
        reviewedProfile: profile,
        privateResumeContext: 'React reporting dashboard PRIVATE_RAW_RESUME',
      }),
    };
    evaluator = {
      evaluateAnswer: jest.fn().mockResolvedValue({
        score: 80,
        feedback: 'Good reasoning',
        strengths: [],
        improvements: [],
      }),
    };
    const roles = {
      findById: jest
        .fn()
        .mockResolvedValue({ name: 'Senior Frontend Engineer' }),
    };
    const users = {
      createProfileIfAbsent: jest.fn(),
      getRoleForEmail: jest.fn().mockResolvedValue('admin'),
    };
    payload = new SessionPayloadService(
      ...([sessions, answers, roles, bank] as unknown as ConstructorParameters<
        typeof SessionPayloadService
      >),
    );
    controller = new SessionsController(
      ...([
        sessions,
        payload,
        bank,
        answers,
        roles,
        evaluator,
        users,
        resumes,
        generator,
      ] as unknown as Deps),
    );
  });
  const startBody = { roleId, difficulty: 'Hard', resumeId };
  const assertPrivate = (value: unknown) => {
    expect(JSON.stringify(value)).not.toMatch(
      /idealAnswer|PRIVATE|resumeEvidence|rationale|competency|questionGenerationMode|privateResumeContext|extractedText|reviewedProfile|schemaName|provider/,
    );
  };
  it('snapshots all five questions atomically and exposes only learner question fields', async () => {
    const start = await controller.startSession(startBody, request);
    expect(sessions.create).toHaveBeenCalledTimes(1);
    expect(stored.questionGenerationMode).toBe('personalized_hybrid');
    expect(stored.resumeId).toBe(resumeId);
    expect(stored.questionSnapshots).toHaveLength(5);
    expect(stored.scheduledBankQuestionIds).toHaveLength(0);
    expect(start.questions.map((q) => q.id)).toEqual(
      stored.questionSnapshots?.map((q) => String(q._id)),
    );
    assertPrivate(start);
    assertPrivate(await payload.assembleSessionPayload(String(stored._id)));
  });
  it('refresh, rehydrate, later resume edits and bank edits/deletion do not change the original set or regenerate', async () => {
    const start = await controller.startSession(startBody, request);
    resumes.getConfirmedInterviewContext.mockResolvedValue({
      reviewedProfile: { ...profile, coreSkills: ['Completely edited'] },
      privateResumeContext: 'CHANGED',
    });
    bank.findByIdsPreserveOrder.mockResolvedValue([]);
    bank.findBankByRoleAndDifficulty.mockResolvedValue(
      bankQuestions(roleId, 'Easy'),
    );
    for (let i = 0; i < 2; i++) {
      stored = SessionModel.hydrate(
        JSON.parse(JSON.stringify(stored.toObject())) as Record<
          string,
          unknown
        >,
      );
      const detail = await payload.assembleSessionPayload(String(stored._id));
      expect(
        detail?.questions.map((q) => ({
          id: q.id,
          text: q.text,
          difficulty: q.difficulty,
        })),
      ).toEqual(
        start.questions.map((q) => ({
          id: q.id,
          text: q.text,
          difficulty: q.difficulty,
        })),
      );
      assertPrivate(detail);
    }
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    expect(resumes.getConfirmedInterviewContext).toHaveBeenCalledTimes(1);
    expect(bank.findByIdsPreserveOrder).not.toHaveBeenCalled();
    expect(bank.findBySession).not.toHaveBeenCalled();
  });
  it.each([0, 2, 3, 4])(
    'evaluates snapshot question %i with private references without fetching the bank',
    async (index) => {
      const start = await controller.startSession(startBody, request);
      const question = stored.questionSnapshots![index];
      const answer = await controller.submitAnswer(
        start.sessionId,
        {
          questionId: String(question._id),
          transcript: 'My reasoning and trade-offs',
        },
        request,
      );
      expect(evaluator.evaluateAnswer).toHaveBeenCalledWith({
        question: question.text,
        idealAnswer: question.idealAnswer,
        transcript: 'My reasoning and trade-offs',
        role: 'Senior Frontend Engineer',
        difficulty: 'Hard',
        questionType: question.type,
      });
      assertPrivate(answer);
      expect(bank.findById).not.toHaveBeenCalled();
      expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    },
  );
  it('starts a personalized session even when no bank questions exist', async () => {
    bank.findBankByRoleAndDifficulty.mockResolvedValue([]);
    provider.generateStructured.mockResolvedValue({
      questions: [...generatedQuestions, additionalRoleQuestion],
    });
    expect(
      (await controller.startSession(startBody, request)).questions,
    ).toHaveLength(5);
    expect(
      stored.questionSnapshots!.filter((q) => q.source === 'target_role'),
    ).toHaveLength(3);
  });
  it('uses the existing real evaluation service with a generated private rubric', async () => {
    const evaluationProvider = {
      generateStructured: jest.fn().mockResolvedValue({
        score: 85,
        feedback: 'Clear boundaries and justified trade-offs.',
        strengths: ['Explained alternatives'],
        improvements: [],
      }),
    };
    const realEvaluator = new InterviewEvaluationService(
      evaluationProvider,
      new HeuristicEvaluationService(),
    );
    evaluator.evaluateAnswer.mockImplementation((input: EvaluationInput) =>
      realEvaluator.evaluateAnswer(input),
    );
    const start = await controller.startSession(startBody, request);
    const result = await controller.submitAnswer(
      start.sessionId,
      {
        questionId: start.questions[0].id,
        transcript:
          'I isolated state and compared alternative component boundaries.',
      },
      request,
    );
    const evaluationRequest = (
      evaluationProvider.generateStructured.mock.calls as unknown[][]
    )[0][0] as { context: EvaluationInput };
    expect(evaluationRequest.context).toMatchObject({
      question: generatedQuestions[0].text,
      idealAnswer: generatedQuestions[0].idealAnswer,
      role: 'Senior Frontend Engineer',
      difficulty: 'Hard',
      questionType: 'technical',
    });
    expect(result.score).toBe(85);
    assertPrivate(result);
  });
  it('persists five fallback questions when generation fails and the bank is sufficient', async () => {
    provider.generateStructured.mockRejectedValue(
      new Error('provider_timeout'),
    );
    bank.findBankByRoleAndDifficulty.mockResolvedValue(
      bankQuestions(roleId, 'Hard'),
    );
    const response = await controller.startSession(startBody, request);
    expect(response.questions).toHaveLength(5);
    expect(stored.questionGenerationMode).toBe('curated_fallback');
    expect(
      stored.questionSnapshots!.every((q) => q.source === 'curated_bank'),
    ).toBe(true);
    assertPrivate(response);
  });
  it('never persists a partial session when both generation and fallback fail', async () => {
    provider.generateStructured.mockRejectedValue(
      new Error('provider_timeout'),
    );
    await expect(
      controller.startSession(startBody, request),
    ).rejects.toMatchObject({ status: 503 });
    expect(sessions.create).not.toHaveBeenCalled();
  });
  it('ownership/confirmation errors prevent generation and session persistence', async () => {
    resumes.getConfirmedInterviewContext.mockRejectedValue(
      new Error('Resume not found'),
    );
    await expect(controller.startSession(startBody, request)).rejects.toThrow(
      'Resume not found',
    );
    expect(resumes.getConfirmedInterviewContext).toHaveBeenCalledWith(
      resumeId,
      'owner',
      roleId,
      'Hard',
    );
    expect(provider.generateStructured).not.toHaveBeenCalled();
    expect(bank.findBankByRoleAndDifficulty).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });
  it('preserves bank-only interviews with fewer than five questions, now using immutable snapshots', async () => {
    const start = await controller.startSession(
      { roleId, difficulty: 'Hard' },
      request,
    );
    expect(start.questions).toHaveLength(1);
    expect(stored.questionGenerationMode).toBe('bank_only');
    expect(provider.generateStructured).not.toHaveBeenCalled();
    expect(resumes.getConfirmedInterviewContext).not.toHaveBeenCalled();
    const original = stored.questionSnapshots![0].text;
    bank.findBankByRoleAndDifficulty.mockResolvedValue([]);
    expect(
      (await payload.assembleSessionPayload(start.sessionId))!.questions[0]
        .text,
    ).toBe(original);
    assertPrivate(start);
  });
  it('preserves legacy bank references and per-session copies', async () => {
    const questions = bankQuestions(roleId, 'Hard');
    const legacy = new SessionModel({
      userId: 'owner',
      roleId,
      difficulty: 'Hard',
      scheduledBankQuestionIds: [String(questions[0]._id)],
    });
    bank.findByIdsPreserveOrder.mockResolvedValue([questions[0]]);
    expect(
      await loadOrderedQuestionsForSession(
        'legacy',
        legacy,
        bank as unknown as Deps[2],
      ),
    ).toEqual([questions[0]]);
    legacy.scheduledBankQuestionIds = [];
    bank.findBySession.mockResolvedValue(questions);
    expect(
      await loadOrderedQuestionsForSession(
        'legacy',
        legacy,
        bank as unknown as Deps[2],
      ),
    ).toEqual(questions);
  });
  it('preserves existing long admin reference answers in bank-only snapshots', async () => {
    const questions = bankQuestions(roleId, 'Hard');
    questions[0].idealAnswer = 'Detailed admin rubric. '.repeat(250);
    bank.findBankByRoleAndDifficulty.mockResolvedValue(questions.slice(0, 1));
    await controller.startSession({ roleId, difficulty: 'Hard' }, request);
    expect(stored.questionSnapshots![0].idealAnswer).toBe(
      questions[0].idealAnswer,
    );
  });
  it('rejects session access or answers from another user and rejects questions outside the snapshot', async () => {
    const start = await controller.startSession(startBody, request);
    const other = { user: { ...request.user, id: 'other' } } as typeof request;
    await expect(
      controller.getSession(start.sessionId, other),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      controller.submitAnswer(
        start.sessionId,
        { questionId: start.questions[0].id, transcript: 'Answer' },
        other,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      controller.submitAnswer(
        start.sessionId,
        { questionId: String(new Types.ObjectId()), transcript: 'Answer' },
        request,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(evaluator.evaluateAnswer).not.toHaveBeenCalled();
  });
});
