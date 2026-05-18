import type { QuestionDocument } from '../questions/question.schema';
import type { QuestionsService } from '../questions/questions.service';
import type { SessionDocument } from './session.schema';

/** Bank-backed sessions use `scheduledBankQuestionIds`; legacy sessions use per-session Question copies. */
export async function loadOrderedQuestionsForSession(
  sessionId: string,
  session: SessionDocument,
  questionsService: QuestionsService,
): Promise<QuestionDocument[]> {
  const scheduled = session.scheduledBankQuestionIds;
  if (scheduled?.length) {
    return questionsService.findByIdsPreserveOrder(scheduled);
  }
  return questionsService.findBySession(sessionId);
}
