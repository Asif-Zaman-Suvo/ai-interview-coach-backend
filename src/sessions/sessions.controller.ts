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
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { QuestionsService } from '../questions/questions.service';
import { AnswersService } from '../answers/answers.service';
import { RolesService } from '../roles/roles.service';
import { AiService } from '../ai/ai.service';
import { AuthGuard } from '../auth/auth.guard';

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
  async getDifficulties() {
    return ['Easy', 'Medium', 'Hard'];
  }

  @Get('me/stats')
  async getUserStats(@Req() req: AuthenticatedRequest) {
    const stats = await this.sessionsService.getUserStats(req.user.id);
    return stats;
  }

  @Get('recent')
  async getRecentSessions(@Req() req: AuthenticatedRequest) {
    const sessions = await this.sessionsService.getRecentSessions(req.user.id);
    const roles = await this.rolesService.findAll();

    return sessions.map((session) => {
      const role = roles.find((r) => r._id.toString() === session.roleId);
      const createdAt = session.createdAt
        ? new Date(session.createdAt)
        : new Date();
      return {
        id: session._id,
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
      date: session.createdAt,
      score: session.score,
    }));
  }

  @Get()
  async getSessions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const sessions = await this.sessionsService.findByUser(
      req.user.id,
      Number(page),
      Number(limit),
    );

    return sessions.map((session) => ({
      id: session._id,
      roleId: session.roleId,
      status: session.status,
      difficulty: session.difficulty,
      score: session.score,
      createdAt: session.createdAt,
    }));
  }

  @Get(':id')
  async getSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const session = await this.sessionsService.findById(id);
    if (!session) {
      return { message: 'Session not found' };
    }

    // Verify user owns this session
    if (session.userId !== req.user.id) {
      return { message: 'Unauthorized' };
    }

    const questions = await this.questionsService.findBySession(id);
    const answers = await this.answersService.findBySession(id);

    return {
      id: session._id,
      roleId: session.roleId,
      status: session.status,
      difficulty: session.difficulty,
      score: session.score,
      summary: session.summary,
      topImprovements: session.topImprovements,
      createdAt: session.createdAt,
      questions: questions.map((q) => ({
        id: q._id,
        text: q.text,
        idealAnswer: q.idealAnswer,
        type: q.type,
        difficulty: q.difficulty,
        answer: answers.find((a) => a.questionId === q._id.toString()),
      })),
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
      sessionId: session._id.toString(),
      roleId: body.roleId,
      text: q.text,
      idealAnswer: q.idealAnswer,
      type: q.type,
      difficulty: q.difficulty,
    }));

    await this.questionsService.createMany(questionsToSave);

    const savedQuestions = await this.questionsService.findBySession(
      session._id.toString(),
    );

    return {
      sessionId: session._id,
      questions: savedQuestions.map((q) => ({
        id: q._id,
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
      (q) => q._id.toString() === body.questionId,
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
            id: nextQuestion._id,
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
