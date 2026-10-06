import type {
  Difficulty,
  Question,
  QuestionType,
} from '../questions/question.schema';

export type QuestionSource =
  | 'resume_personalized'
  | 'target_role'
  | 'curated_bank';
export type SessionQuestion = Pick<
  Question,
  '_id' | 'text' | 'idealAnswer' | 'type' | 'difficulty' | 'roleId'
>;
export interface GeneratedQuestion {
  text: string;
  idealAnswer: string;
  type: QuestionType;
  source: 'resume_personalized' | 'target_role';
  competency: string;
  rationale: string;
  resumeEvidence: string[];
}
export interface QuestionSnapshot extends SessionQuestion {
  source: QuestionSource;
  bankQuestionId?: string;
  competency?: string;
  rationale?: string;
  resumeEvidence?: string[];
}
const stringSchema = (minLength: number, maxLength: number) => ({
  type: 'string',
  minLength,
  maxLength,
});
export function questionGenerationSchema(count: number) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'text',
            'idealAnswer',
            'type',
            'source',
            'competency',
            'rationale',
          ],
          properties: {
            text: stringSchema(20, 1500),
            idealAnswer: stringSchema(40, 4000),
            type: { type: 'string', enum: ['technical', 'behavioral'] },
            source: {
              type: 'string',
              enum: ['resume_personalized', 'target_role'],
            },
            competency: stringSchema(3, 120),
            rationale: stringSchema(10, 500),
          },
        },
      },
    },
  };
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= min &&
    value.length <= max
  );
}
export function normalizeQuestion(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
const stopWords = new Set(
  'a an the and or of to in on for with how what would you your do does is are explain describe discuss can could have has when why which as at it that this from'.split(
    ' ',
  ),
);
function tokens(value: string): Set<string> {
  return new Set(
    normalizeQuestion(value)
      .split(' ')
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );
}
export function similarQuestions(a: string, b: string): boolean {
  if (normalizeQuestion(a) === normalizeQuestion(b)) return true;
  const left = tokens(a),
    right = tokens(b);
  if (!left.size || !right.size) return false;
  const shared = [...left].filter((word) => right.has(word)).length;
  return (
    shared / (left.size + right.size - shared) >= 0.65 ||
    (Math.min(left.size, right.size) >= 4 &&
      shared / Math.min(left.size, right.size) >= 0.85)
  );
}
export function assertQuestionDiversity(
  questions: { text: string; competency?: string }[],
): void {
  for (let i = 0; i < questions.length; i++) {
    for (let j = 0; j < i; j++) {
      if (
        similarQuestions(questions[i].text, questions[j].text) ||
        (questions[i].competency &&
          questions[j].competency &&
          similarQuestions(questions[i].competency!, questions[j].competency!))
      ) {
        throw new Error('invalid_question_diversity');
      }
    }
  }
}
// Defense in depth; semantic safety and role relevance are also enforced by the prompt.
const sensitiveQuestion =
  /\b(age|gender|religion|ethnicity|marital status|home address|photograph|pregnan\w*|sexual orientation|medical history|disabilit\w*)\b/i;
export function validateGeneratedQuestions(
  value: unknown,
  roleQuestionCount: number,
  evidence: string[],
): GeneratedQuestion[] {
  const fail = () => {
    throw new Error('invalid_generated_questions');
  };
  if (
    !object(value) ||
    Object.keys(value).length !== 1 ||
    !Array.isArray(value.questions) ||
    value.questions.length !== 2 + roleQuestionCount
  )
    return fail();
  const keys = [
    'text',
    'idealAnswer',
    'type',
    'source',
    'competency',
    'rationale',
  ];
  const questions: GeneratedQuestion[] = value.questions.map(
    (item: unknown) => {
      if (
        !object(item) ||
        Object.keys(item).length !==
          keys.length + (Object.hasOwn(item, 'resumeEvidence') ? 1 : 0) ||
        !keys.every((k) => Object.hasOwn(item, k)) ||
        !text(item.text, 20, 1500) ||
        !text(item.idealAnswer, 40, 4000) ||
        typeof item.type !== 'string' ||
        !['technical', 'behavioral'].includes(item.type) ||
        typeof item.source !== 'string' ||
        !['resume_personalized', 'target_role'].includes(item.source) ||
        !text(item.competency, 3, 120) ||
        !text(item.rationale, 10, 500) ||
        (Object.hasOwn(item, 'resumeEvidence') &&
          (!Array.isArray(item.resumeEvidence) ||
            item.resumeEvidence.length > 4 ||
            !item.resumeEvidence.every(
              (entry: unknown) =>
                typeof entry === 'string' && evidence.includes(entry),
            ))) ||
        sensitiveQuestion.test(item.text) ||
        sensitiveQuestion.test(item.idealAnswer)
      )
        return fail();
      const questionWords = new Set(normalizeQuestion(item.text).split(' '));
      const grounded = (entry: string) =>
        normalizeQuestion(entry)
          .split(' ')
          .some(
            (word) => word && !stopWords.has(word) && questionWords.has(word),
          );
      // Derive private provenance locally. Target-role questions need no resume metadata.
      const entries = Object.hasOwn(item, 'resumeEvidence')
        ? (item.resumeEvidence as string[])
        : item.source === 'resume_personalized'
          ? evidence.filter(grounded).slice(0, 4)
          : [];
      if (item.source === 'resume_personalized') {
        if (!entries.length || !entries.some(grounded)) return fail();
      } else if (entries.length) return fail();
      return {
        text: item.text.trim(),
        idealAnswer: item.idealAnswer.trim(),
        type: item.type as QuestionType,
        source: item.source as GeneratedQuestion['source'],
        competency: item.competency.trim(),
        rationale: item.rationale.trim(),
        resumeEvidence: [...entries],
      };
    },
  );
  if (
    questions.filter((q) => q.source === 'resume_personalized').length !== 2 ||
    questions.filter((q) => q.source === 'target_role').length !==
      roleQuestionCount
  )
    return fail();
  assertQuestionDiversity(questions);
  return questions;
}
export function validBankQuestion(
  q: SessionQuestion,
  roleId: string,
  difficulty: Difficulty,
): boolean {
  return (
    q.roleId === roleId &&
    q.difficulty === difficulty &&
    text(q.text, 1, 1500) &&
    text(q.idealAnswer, 1, 4000) &&
    ['technical', 'behavioral'].includes(q.type) &&
    !sensitiveQuestion.test(q.text)
  );
}
