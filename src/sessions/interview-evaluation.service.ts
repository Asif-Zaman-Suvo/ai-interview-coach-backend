import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER } from '../llm/llm-provider.interface';
import type { LlmProvider } from '../llm/llm-provider.interface';
import { HeuristicEvaluationService } from './heuristic-evaluation.service';
import {
  evaluationPrompt,
  evaluationSchema,
  validateEvaluation,
} from './evaluation.contract';
import type {
  EvaluationInput,
  EvaluationOutput,
  EvaluationSource,
} from './evaluation.contract';
import {
  sessionSummaryPrompt,
  sessionSummarySchema,
  validateSessionSummary,
} from './session-summary.contract';
import type {
  SessionSummaryInput,
  SessionSummaryOutput,
} from './session-summary.contract';
@Injectable()
export class InterviewEvaluationService {
  private readonly logger = new Logger(InterviewEvaluationService.name);
  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly heuristic: HeuristicEvaluationService,
  ) {}
  /** Only allowlisted error codes reach logs, never arbitrary error messages. */
  private failureCode(error: unknown): string {
    if (!(error instanceof Error)) return 'unknown_error';
    const code = error.message;
    const known = [
      'provider_not_configured',
      'provider_timeout',
      'provider_network_error',
      'provider_invalid_response',
      'provider_output_limit',
      'provider_unavailable',
      'invalid_evaluation',
      'invalid_session_summary',
    ];
    return known.includes(code) || /^provider_http_error:[1-5]\d{2}$/.test(code)
      ? code
      : 'unknown_error';
  }
  async evaluateAnswer(
    input: EvaluationInput,
  ): Promise<EvaluationOutput & { evaluationSource: EvaluationSource }> {
    try {
      const output = await this.provider.generateStructured({
        system: evaluationPrompt,
        context: { ...input },
        schema: evaluationSchema,
      });
      return { ...validateEvaluation(output), evaluationSource: 'llm' };
    } catch (error) {
      this.logger.warn(
        `LLM evaluation unavailable [${this.failureCode(error)}]; using heuristic fallback`,
      );
      const result = this.heuristic.evaluateAnswer(
        input.question,
        input.idealAnswer,
        input.transcript,
      );
      result.feedback =
        'AI evaluation was unavailable; this is a basic automated assessment. ' +
        result.feedback;
      return {
        ...validateEvaluation(result),
        evaluationSource: 'heuristic_fallback',
      };
    }
  }
  async summarizeSession(
    input: SessionSummaryInput,
  ): Promise<SessionSummaryOutput & { summarySource: EvaluationSource }> {
    if (input.answers.length === 0) {
      return {
        summary:
          'No answers were submitted in this session. Complete an answer to receive personalized feedback.',
        topImprovements: [],
        summarySource: 'heuristic_fallback',
      };
    }
    try {
      const output = await this.provider.generateStructured({
        system: sessionSummaryPrompt,
        context: {
          role: input.role,
          difficulty: input.difficulty,
          answers: input.answers.map((answer) => ({ ...answer })),
        },
        schema: sessionSummarySchema,
        schemaName: 'interview_session_summary',
      });
      return { ...validateSessionSummary(output), summarySource: 'llm' };
    } catch (error) {
      this.logger.warn(
        `LLM session summary unavailable [${this.failureCode(error)}]; using heuristic fallback`,
      );
      const fallback = this.heuristic.summarizeSession(
        input.answers.map((a) => a.score),
        input.answers.map((a) => a.feedback),
      );
      return {
        ...validateSessionSummary(fallback),
        summarySource: 'heuristic_fallback',
      };
    }
  }
}
