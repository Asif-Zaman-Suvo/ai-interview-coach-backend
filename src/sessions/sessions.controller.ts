import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { QuestionsService } from '../questions/questions.service';
import { AnswersService } from '../answers/answers.service';
import { RolesService } from '../roles/roles.service';
import { InterviewEvaluationService } from './interview-evaluation.service';
import { AuthGuard } from '../auth/auth.guard';
import { asDate } from '../common/as-date';
import type { SessionDocument } from './session.schema';
import type { QuestionDocument } from '../questions/question.schema';
import {
  buildRoleNameMap,
  summarizeSessionForListRow,
  uniqueRoleIdsFromSessions,
} from './sessions-list.mapper';
import { UsersService } from '../users/users.service';
import { sessionLimitForPlan } from '../common/billing.constants';

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function canonicalUserId(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly questionsService: QuestionsService,
    private readonly answersService: AnswersService,
    private readonly rolesService: RolesService,
    private readonly interviewEvaluation: InterviewEvaluationService,
    private readonly usersService: UsersService,
  ) {}

  /** Bank-backed sessions use `scheduledBankQuestionIds`; legacy sessions use per-session Question copies. */
  private async resolveQuestionsForSession(
    sessionId: string,
    session: SessionDocument,
  ): Promise<QuestionDocument[]> {
    const scheduled = session.scheduledBankQuestionIds;
    if (scheduled?.length) {
      return this.questionsService.findByIdsPreserveOrder(scheduled);
    }
    return this.questionsService.findBySession(sessionId);
  }

  private async resolveRoleLabels(
    sessions: SessionDocument[],
  ): Promise<Map<string, string>> {
    const rolesList = await this.rolesService.findAll();
    const roleNames = buildRoleNameMap(rolesList);
    const missing = uniqueRoleIdsFromSessions(sessions).filter(
      (id) => !roleNames.has(id),
    );
    if (missing.length > 0) {
      const docs = await Promise.all(
        missing.map((id) => this.rolesService.findById(id)),
      );
      missing.forEach((id, i) => {
        const doc = docs[i];
        roleNames.set(id, doc?.name?.trim() ? doc.name.trim() : 'Unknown');
      });
    }
    return roleNames;
  }

  @Get('difficulties')
  getDifficulties() {
    return ['Easy', 'Medium', 'Hard'];
  }

  @Get('me/stats')
  async getUserStats(@Req() req: AuthenticatedRequest) {
    const stats = await this.sessionsService.getUserStats(
      canonicalUserId(req.user.id),
    );
    if (!stats.bestRole) {
      return stats;
    }
    const role = await this.rolesService.findById(stats.bestRole);
    return {
      ...stats,
      bestRole: role?.name ?? null,
    };
  }

  @Get('recent')
  async getRecentSessions(@Req() req: AuthenticatedRequest) {
    const sessions = await this.sessionsService.getRecentSessions(
      canonicalUserId(req.user.id),
    );
    const labels = await this.resolveRoleLabels(sessions);

    return sessions.map((session) => {
      const row = summarizeSessionForListRow(session, labels);
      return {
        id: row.id,
        role: row.role,
        date: row.date,
        duration: row.duration,
        score: row.score,
      };
    });
  }

  @Get('score-trend')
  async getScoreTrend(@Req() req: AuthenticatedRequest) {
    const sessions = await this.sessionsService.getScoreTrend(
      canonicalUserId(req.user.id),
    );
    return sessions.map((session) => ({
      date: asDate(session.createdAt as unknown).toISOString(),
      score: session.score,
    }));
  }

  @Get('quota')
  async getSessionQuota(@Req() req: AuthenticatedRequest) {
    const userId = canonicalUserId(req.user.id);
    const email = (req.user.email ?? '').trim().toLowerCase();
    await this.usersService.createProfileIfAbsent({ email });
    const plan = await this.usersService.getPlanForEmail(email);
    const sessionsUsed = await this.sessionsService.countByUser(userId);
    const sessionLimit = sessionLimitForPlan(plan);
    const canStartNewSession = sessionsUsed < sessionLimit;
    return {
      plan,
      sessionsUsed,
      sessionLimit,
      canStartNewSession,
    };
  }

  @Get()
  async getSessions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const pageNum = Math.max(1, Math.min(10_000, Number(page) || 1));
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 10));

    const userId = canonicalUserId(req.user.id);

    const [sessions, total] = await Promise.all([
      this.sessionsService.findByUser(userId, pageNum, limitNum),
      this.sessionsService.countByUser(userId),
    ]);

    const labels = await this.resolveRoleLabels(sessions);
    const items = sessions.map((session) =>
      summarizeSessionForListRow(session, labels),
    );

    const totalPages = Math.max(1, Math.ceil(total / limitNum) || 1);

    return {
      sessions: items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }

  @Get(':id')
  async getSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const session = await this.sessionsService.findById(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (canonicalUserId(session.userId) !== canonicalUserId(req.user.id)) {
      throw new ForbiddenException('Unauthorized');
    }

    const questions = await this.resolveQuestionsForSession(id, session);
    const answers = await this.answersService.findBySession(id);
    const roleDoc = await this.rolesService.findById(session.roleId);

    const createdAt = asDate(session.createdAt);
    const updatedAt = session.updatedAt ? asDate(session.updatedAt) : createdAt;
    const deltaMs = updatedAt.getTime() - createdAt.getTime();
    const durationSeconds =
      Number.isFinite(deltaMs) && deltaMs > 0 ? Math.floor(deltaMs / 1000) : 0;

    const mapCategory = (
      qt: string,
    ): 'Technical' | 'Behavioral' | 'System Design' | 'Situational' =>
      qt === 'behavioral' ? 'Behavioral' : 'Technical';

    const questionDtos = questions.map((q) => ({
      id: String(q._id),
      text: q.text,
      category: mapCategory(q.type),
      difficulty: q.difficulty,
    }));

    const answerDtos = answers.map((a) => {
      const doc = a as { createdAt?: Date; userAnswer?: string };
      return {
        questionId: a.questionId,
        transcript: a.transcript,
        userAnswer: doc.userAnswer ?? a.transcript,
        audioDuration: 0,
        submittedAt: doc.createdAt ?? createdAt,
      };
    });

    const feedbackDtos = answers.map((a) => {
      const q = questions.find((x) => String(x._id) === String(a.questionId));
      const userAns = a.userAnswer ?? a.transcript;
      return {
        questionId: a.questionId,
        question: q?.text ?? '',
        transcript: userAns,
        feedback: a.feedback,
        score: a.score,
        strengths: a.strengths ?? [],
        improvements: a.improvements ?? [],
      };
    });

    return {
      id: String(session._id),
      userId: session.userId,
      roleId: session.roleId,
      role: roleDoc?.name ?? 'Unknown',
      status: session.status,
      difficulty: session.difficulty,
      score: session.score,
      summary: session.summary,
      topImprovements: session.topImprovements,
      startedAt: createdAt,
      createdAt,
      duration: durationSeconds,
      questions: questionDtos,
      answers: answerDtos,
      feedback: feedbackDtos,
    };
  }

  @Post('start')
  async startSession(
    @Body()
    body: {
      roleId: string;
      difficulty: string;
      resumeText?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const role = await this.rolesService.findById(body.roleId);
    if (!role) {
      return { message: 'Role not found' };
    }

    const userId = canonicalUserId(req.user.id);
    const email = (req.user.email ?? '').trim().toLowerCase();
    await this.usersService.createProfileIfAbsent({ email });
    const plan = await this.usersService.getPlanForEmail(email);
    const limit = sessionLimitForPlan(plan);
    const count = await this.sessionsService.countByUser(userId);
    if (count >= limit) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Your plan includes ${limit} interview session${limit === 1 ? '' : 's'}. Purchase a higher pack for more.`,
        code: 'SESSION_LIMIT_REACHED',
      });
    }

    const pool = await this.questionsService.findBankByRoleAndDifficulty(
      body.roleId,
      body.difficulty,
    );
    if (!pool.length) {
      const message =
        `There are no practice questions for "${role.name}" at ${body.difficulty} difficulty yet. ` +
        'Try another difficulty, or ask an administrator to add questions in the admin panel.';
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message,
        code: 'QUESTION_BANK_EMPTY',
        roleId: body.roleId,
        difficulty: body.difficulty,
      });
    }

    shuffleInPlace(pool);
    const maxPerSession = Math.min(5, pool.length);
    const picked = pool.slice(0, maxPerSession);

    const session = await this.sessionsService.create({
      userId,
      roleId: body.roleId,
      difficulty: body.difficulty,
      scheduledBankQuestionIds: picked.map((q) => String(q._id)),
    });

    return {
      sessionId: String(session._id),
      questions: picked.map((q) => ({
        id: String(q._id),
        text: q.text,
        idealAnswer: q.idealAnswer,
        type: q.type,
        difficulty: q.difficulty,
      })),
    };
  }

  @Post(':id/answer')
  async submitAnswer(
    @Param('id') sessionId: string,
    @Body()
    body: {
      questionId: string;
      transcript: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const session = await this.sessionsService.findById(sessionId);
    if (!session) {
      return { message: 'Session not found' };
    }

    if (canonicalUserId(session.userId) !== canonicalUserId(req.user.id)) {
      return { message: 'Unauthorized' };
    }

    const question = await this.questionsService.findById(body.questionId);
    if (!question) {
      return { message: 'Question not found' };
    }

    const ordered = await this.resolveQuestionsForSession(sessionId, session);
    const allowed = new Set(ordered.map((q) => String(q._id)));
    if (!allowed.has(String(body.questionId))) {
      throw new BadRequestException('Question is not part of this session');
    }

    const evaluation = this.interviewEvaluation.evaluateAnswer(
      question.text,
      question.idealAnswer,
      body.transcript,
    );

    // Save answer to database
    const answer = await this.answersService.create({
      sessionId,
      questionId: body.questionId,
      transcript: body.transcript,
      feedback: evaluation.feedback,
      score: evaluation.score,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
    });

    // Get next question
    const allQuestions = await this.resolveQuestionsForSession(
      sessionId,
      session,
    );
    const currentIndex = allQuestions.findIndex(
      (q) => String(q._id) === String(body.questionId),
    );
    const nextQuestion =
      currentIndex >= 0 && currentIndex < allQuestions.length - 1
        ? allQuestions[currentIndex + 1]
        : null;

    return {
      transcript: answer.transcript,
      feedback: answer.feedback,
      score: answer.score,
      strengths: answer.strengths,
      improvements: answer.improvements,
      nextQuestion: nextQuestion
        ? {
            id: String(nextQuestion._id),
            text: nextQuestion.text,
            type: nextQuestion.type,
            difficulty: nextQuestion.difficulty,
          }
        : null,
    };
  }

  @Post(':id/complete')
  async completeSession(
    @Param('id') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const session = await this.sessionsService.findById(sessionId);
    if (!session) {
      return { message: 'Session not found' };
    }

    if (canonicalUserId(session.userId) !== canonicalUserId(req.user.id)) {
      return { message: 'Unauthorized' };
    }

    // Calculate final score
    const finalScore =
      await this.answersService.calculateAverageScore(sessionId);

    // Get all answers for summary
    const answers = await this.answersService.findBySession(sessionId);
    const scores = answers.map((a) => a.score);
    const feedbacks = answers.map((a) => a.feedback);

    const summary = this.interviewEvaluation.summarizeSession(
      scores,
      feedbacks,
    );

    // Update session
    await this.sessionsService.update(sessionId, {
      status: 'completed',
      score: finalScore,
      summary: summary.summary,
      topImprovements: summary.topImprovements,
    });

    return {
      finalScore,
      summary: summary.summary,
      topImprovements: summary.topImprovements,
    };
  }

  @Delete(':id')
  async deleteSession(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const session = await this.sessionsService.findById(id);
    if (!session) {
      return { message: 'Session not found' };
    }

    if (canonicalUserId(session.userId) !== canonicalUserId(req.user.id)) {
      return { message: 'Unauthorized' };
    }

    await this.answersService.deleteBySession(id);
    await this.questionsService.deleteBySession(id);
    await this.sessionsService.delete(id);

    return { message: 'Session deleted successfully' };
  }
}
