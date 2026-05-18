import { Injectable } from '@nestjs/common';
import { AnswersService } from '../answers/answers.service';
import { RolesService } from '../roles/roles.service';
import { asDate } from '../common/as-date';
import type { SessionStatus } from './session.schema';
import { SessionsService } from './sessions.service';
import { loadOrderedQuestionsForSession } from './session-questions.util';
import { QuestionsService } from '../questions/questions.service';

export interface AssembledSessionPayload {
  id: string;
  userId: string;
  roleId: string;
  role: string;
  status: SessionStatus;
  difficulty: string;
  score: number;
  summary?: string;
  topImprovements: string[];
  startedAt: Date;
  createdAt: Date;
  duration: number;
  questions: Array<{
    id: string;
    text: string;
    category: 'Technical' | 'Behavioral' | 'System Design' | 'Situational';
    difficulty: string;
  }>;
  answers: Array<{
    questionId: string;
    transcript: string;
    userAnswer: string;
    audioDuration: number;
    submittedAt: Date;
  }>;
  feedback: Array<{
    questionId: string;
    question: string;
    transcript: string;
    feedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
  }>;
}

@Injectable()
export class SessionPayloadService {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly answersService: AnswersService,
    private readonly rolesService: RolesService,
    private readonly questionsService: QuestionsService,
  ) {}

  /** Full session payload for `GET /sessions/:id` and admin interview detail. */
  async assembleSessionPayload(
    sessionId: string,
  ): Promise<AssembledSessionPayload | null> {
    const session = await this.sessionsService.findById(sessionId);
    if (!session) {
      return null;
    }

    const id = sessionId;
    const questions = await loadOrderedQuestionsForSession(
      id,
      session,
      this.questionsService,
    );
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
      userId: String(session.userId),
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
    } satisfies AssembledSessionPayload;
  }
}
