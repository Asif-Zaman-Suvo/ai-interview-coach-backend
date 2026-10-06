import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { LLM_PROVIDER } from '../llm/llm-provider.interface';
import type { LlmProvider } from '../llm/llm-provider.interface';
import type { ResumeProfile } from '../resumes/resume.contract';
import type { Difficulty } from '../questions/question.schema';
import {
  assertQuestionDiversity,
  questionGenerationSchema,
  validBankQuestion,
  validateGeneratedQuestions,
} from './question-generation.contract';
import type {
  QuestionSnapshot,
  SessionQuestion,
} from './question-generation.contract';
import {
  privateProfessionalContext,
  questionGenerationSystem,
  reviewedEvidence,
  reviewedProfessionalContext,
} from './question-generation.prompt';

export interface PersonalizedInterviewInput {
  roleId: string;
  targetRole: string;
  difficulty: Difficulty;
  reviewedProfile: ResumeProfile;
  privateResumeContext: string;
  bank: SessionQuestion[];
}
@Injectable()
export class QuestionGenerationService {
  private readonly logger = new Logger(QuestionGenerationService.name);
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  private failureCode(error: unknown): string {
    const code = error instanceof Error ? error.message : '';
    const known = [
      'invalid_generated_questions',
      'invalid_question_diversity',
      'provider_invalid_response',
      'provider_not_configured',
      'provider_timeout',
      'provider_network_error',
      'provider_output_limit',
      'provider_unavailable',
    ];
    return known.includes(code) || /^provider_http_error:[1-5]\d{2}$/.test(code)
      ? code
      : 'unknown_error';
  }

  snapshotBank(question: SessionQuestion): QuestionSnapshot {
    return {
      _id: new Types.ObjectId(),
      text: question.text,
      idealAnswer: question.idealAnswer,
      type: question.type,
      difficulty: question.difficulty,
      roleId: question.roleId,
      source: 'curated_bank',
      bankQuestionId: String(question._id),
    };
  }

  async generate(input: PersonalizedInterviewInput): Promise<{
    questions: QuestionSnapshot[];
    mode: 'personalized_hybrid' | 'curated_fallback';
  }> {
    const bank = input.bank.filter((q) =>
      validBankQuestion(q, input.roleId, input.difficulty),
    );
    // Prefer technical evidence for the curated slot; the generator sees it and varies the remaining topics/types.
    const curated = bank.find((q) => q.type === 'technical') ?? bank[0];
    const roleCount = curated ? 2 : 3;
    let previousFailure: string | undefined;
    // At most one retry for malformed/duplicate output, only during session start.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const evidence = reviewedEvidence(input.reviewedProfile);
        if (!evidence.length) throw new Error('invalid_generated_questions');
        const output = await this.provider.generateStructured({
          system: questionGenerationSystem,
          context: {
            targetRole: input.targetRole,
            difficulty: input.difficulty,
            reviewedProfile: reviewedProfessionalContext(input.reviewedProfile),
            reviewedEvidence: evidence,
            privateResumeContext: privateProfessionalContext(
              input.privateResumeContext,
              input.reviewedProfile,
            ),
            composition: { resume_personalized: 2, target_role: roleCount },
            curatedQuestion: curated
              ? { text: curated.text, type: curated.type }
              : null,
            ...(previousFailure
              ? {
                  validationFeedback: {
                    code: previousFailure,
                    instruction:
                      'Return a fresh complete set satisfying the exact composition, reviewed evidence and distinct competencies. Do not repeat the invalid set.',
                  },
                }
              : {}),
          },
          schemaName: 'personalized_interview_questions',
          schema: questionGenerationSchema(2 + roleCount),
          maxOutputTokens: 5000,
        });
        const generated = validateGeneratedQuestions(
          output,
          roleCount,
          evidence,
        );
        const questions: QuestionSnapshot[] = generated.map((q) => ({
          ...q,
          _id: new Types.ObjectId(),
          roleId: input.roleId,
          difficulty: input.difficulty,
        }));
        if (curated) questions.push(this.snapshotBank(curated));
        assertQuestionDiversity(questions);
        return { questions, mode: 'personalized_hybrid' };
      } catch (error) {
        const code = this.failureCode(error);
        this.logger.warn(
          `Question generation attempt ${attempt + 1} failed [${code}]`,
        );
        const retryable = [
          'provider_invalid_response',
          'invalid_generated_questions',
          'invalid_question_diversity',
        ].includes(code);
        if (
          attempt === 0 &&
          retryable &&
          reviewedEvidence(input.reviewedProfile).length
        ) {
          previousFailure = code;
          continue;
        }
        break;
      }
    }
    // No writes occurred before validation; fallback remains fully curated.
    const fallback: QuestionSnapshot[] = [];
    for (const q of bank) {
      const candidate = this.snapshotBank(q);
      try {
        assertQuestionDiversity([...fallback, candidate]);
      } catch {
        continue;
      }
      fallback.push(candidate);
      if (fallback.length === 5)
        return { questions: fallback, mode: 'curated_fallback' };
    }
    throw new ServiceUnavailableException({
      code: 'QUESTION_GENERATION_UNAVAILABLE',
      retryable: true,
      message:
        'Interview questions are temporarily unavailable. Please retry starting your interview.',
    });
  }
}
