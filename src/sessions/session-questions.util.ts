import type { SessionQuestion } from './question-generation.contract';
import type { QuestionsService } from '../questions/questions.service';
import type { SessionDocument } from './session.schema';

/** Prefer immutable snapshots; preserve older bank references and per-session copies. */
export async function loadOrderedQuestionsForSession(
  sessionId: string,
  session: SessionDocument,
  questionsService: QuestionsService,
): Promise<SessionQuestion[]> {
  if (session.questionSnapshots !== undefined) return session.questionSnapshots;
  const scheduled = session.scheduledBankQuestionIds;
  if (scheduled?.length) {
    return questionsService.findByIdsPreserveOrder(scheduled);
  }
  return questionsService.findBySession(sessionId);
}
