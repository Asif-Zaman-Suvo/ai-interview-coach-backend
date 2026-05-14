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
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { QuestionsService } from '../questions/questions.service';
import { AnswersService } from '../answers/answers.service';
import { RolesService } from '../roles/roles.service';
import { AiService } from '../ai/ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { asDate } from '../common/as-date';

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
    private readonly aiService: AiService,
  ) {}

  @Get('difficulties')
  getDifficulties() {
    return ['Easy', 'Medium', 'Hard'];
  }

  @Get('me/stats')
  async getUserStats(@Req() req: AuthenticatedRequest) {
    const stats = await this.sessionsService.getUserStats(req.user.id);
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
    const sessions = await this.sessionsService.getRecentSessions(req.user.id);
    const roles = await this.rolesService.findAll();

    return sessions.map((session) => {
      const role = roles.find((r) => String(r._id) === session.roleId);
      const createdAt = asDate(session.createdAt as unknown);
      return {
        id: String(session._id),
        role: role ? role.name : 'Unknown',
        date: createdAt,
        duration: Math.floor(
          (new Date().getTime() - createdAt.getTime()) / (1000 * 60),
        ),
        score: session.score,
      };
    });
  }

  @Get('score-trend')
  async getScoreTrend(@Req() req: AuthenticatedRequest) {
    const sessions = await this.sessionsService.getScoreTrend(req.user.id);
    return sessions.map((session) => ({
      date: asDate(session.createdAt as unknown),
      score: session.score,
    }));
  }

  @Get()
  async getSessions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [sessions, total] = await Promise.all([
      this.sessionsService.findByUser(req.user.id, pageNum, limitNum),
      this.sessionsService.countByUser(req.user.id),
    ]);

    const roles = await this.rolesService.findAll();

    const items = sessions.map((session) => {
      const role = roles.find((r) => String(r._id) === session.roleId);
      const createdAt = asDate(session.createdAt as unknown);
      return {
        id: String(session._id),
        role: role?.name ?? 'Unknown',
        date: createdAt,
        duration: Math.floor(
          (Date.now() - createdAt.getTime()) / (1000 * 60),
        ),
        score: session.score,
        status: session.status === 'completed' ? 'completed' : 'in_progress',
        difficulty: session.difficulty,
      };
    });

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

    if (session.userId !== req.user.id) {
      throw new ForbiddenException('Unauthorized');
    }

    const questions = await this.questionsService.findBySession(id);
    const answers = await this.answersService.findBySession(id);
    const roleDoc = await this.rolesService.findById(session.roleId);

    const createdAt = asDate(session.createdAt as unknown);
    const updatedAt = session.updatedAt
      ? asDate(session.updatedAt as unknown)
      : createdAt;
    const durationSeconds = Math.max(
      0,
      Math.floor((updatedAt.getTime() - createdAt.getTime()) / 1000),
    );

    const mapCategory = (
      qt: string,
    ): 'Technical' | 'Behavioral' | 'System Design' | 'Situational' =>
      qt === 'behavioral' ? 'Behavioral' : 'Technical';

    const questionDtos = questions.map((q) => ({
      id: String(q._id),
      text: q.text,
      category: mapCategory(q.type),
      difficulty: q.difficulty as 'Easy' | 'Medium' | 'Hard',
    }));

    const answerDtos = answers.map((a) => {
      const doc = a as { createdAt?: Date };
      return {
        questionId: a.questionId,
        transcript: a.transcript,
        audioDuration: 0,
        submittedAt: doc.createdAt ?? createdAt,
      };
    });

    const feedbackDtos = answers.map((a) => {
      const q = questions.find((x) => String(x._id) === a.questionId);
      return {
        questionId: a.questionId,
        question: q?.text ?? '',
        transcript: a.transcript,
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

    // Generate questions using AI
    const generatedQuestions = await this.aiService.generateQuestions(
      role.name,
      body.difficulty,
      body.resumeText,
    );

    // Create session
    const session = await this.sessionsService.create({
      userId: req.user.id,
      roleId: body.roleId,
      difficulty: body.difficulty,
    });

    // Save questions to database
    const questionsToSave = generatedQuestions.map((q) => ({
      sessionId: String(session._id),
      roleId: body.roleId,
      text: q.text,
      idealAnswer: q.idealAnswer,
      type: q.type,
      difficulty: q.difficulty,
    }));

    await this.questionsService.createMany(questionsToSave);

    const savedQuestions = await this.questionsService.findBySession(
      String(session._id),
    );

    return {
      sessionId: String(session._id),
      questions: savedQuestions.map((q) => ({
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

    if (session.userId !== req.user.id) {
      return { message: 'Unauthorized' };
    }

    const question = await this.questionsService.findById(body.questionId);
    if (!question) {
      return { message: 'Question not found' };
    }

    // Evaluate answer using AI
    const evaluation = await this.aiService.evaluateAnswer(
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
    const allQuestions = await this.questionsService.findBySession(sessionId);
    const currentIndex = allQuestions.findIndex(
      (q) => String(q._id) === body.questionId,
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

    if (session.userId !== req.user.id) {
      return { message: 'Unauthorized' };
    }

    // Calculate final score
    const finalScore =
      await this.answersService.calculateAverageScore(sessionId);

    // Get all answers for summary
    const answers = await this.answersService.findBySession(sessionId);
    const scores = answers.map((a) => a.score);
    const feedbacks = answers.map((a) => a.feedback);

    // Generate summary using AI
    const summary = await this.aiService.generateSessionSummary(
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

    if (session.userId !== req.user.id) {
      return { message: 'Unauthorized' };
    }

    await this.answersService.deleteBySession(id);
    await this.questionsService.deleteBySession(id);
    await this.sessionsService.delete(id);

    return { message: 'Session deleted successfully' };
  }
}
