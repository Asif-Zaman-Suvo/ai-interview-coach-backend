import type {
  GeneratedQuestion,
  SessionQuestion,
} from '../../src/sessions/question-generation.contract';
import { Types } from 'mongoose';

export const generatedQuestions: GeneratedQuestion[] = [
  {
    text: 'How did you structure React components in your reporting dashboard to keep business logic maintainable?',
    idealAnswer:
      'A strong response explains component boundaries, separation of state and business logic, multiple reasonable patterns, testability and maintainability trade-offs.',
    type: 'technical',
    source: 'resume_personalized',
    competency: 'Component architecture',
    rationale:
      'Reviewed React experience supports assessing target-role architectural decisions.',
    resumeEvidence: ['React'],
  },
  {
    text: 'How did you use TypeScript to make API contracts safer, and what runtime validation trade-offs did you encounter?',
    idealAnswer:
      'Cover type safety, explicit domain contracts, runtime validation at trust boundaries, limitations of compile-time types and alternatives that fit the application.',
    type: 'technical',
    source: 'resume_personalized',
    competency: 'Typed data contracts',
    rationale:
      'Reviewed TypeScript evidence grounds the question in actual professional skills.',
    resumeEvidence: ['TypeScript'],
  },
  {
    text: 'How would you investigate excessive rendering and improve responsiveness in a complex user interface?',
    idealAnswer:
      'Discuss profiling before optimizing, identifying state subscriptions and costly work, measuring changes, reasonable memoization and its complexity trade-offs.',
    type: 'technical',
    source: 'target_role',
    competency: 'Rendering performance',
    rationale:
      'Senior frontend candidates should reason about measured user-interface performance.',
    resumeEvidence: [],
  },
  {
    text: 'Describe how you would resolve conflicting accessibility requirements with a designer under a tight delivery deadline.',
    idealAnswer:
      'Cover collaborative communication, clarifying user needs, accessibility standards, prioritizing impact, evaluating compromises and verifying outcomes with stakeholders.',
    type: 'behavioral',
    source: 'target_role',
    competency: 'Accessibility collaboration',
    rationale:
      'Assesses senior role responsibility for inclusive delivery and collaboration.',
    resumeEvidence: [],
  },
];
export const additionalRoleQuestion: GeneratedQuestion = {
  text: 'How would you design a testing strategy that balances end-to-end coverage against fast developer feedback?',
  idealAnswer:
    'Discuss risk-based test selection, unit and integration coverage, critical user journeys, avoiding brittle tests, feedback latency and maintenance trade-offs.',
  type: 'technical',
  source: 'target_role',
  competency: 'Testing strategy',
  rationale:
    'Assesses a distinct target-role competency even when the curated bank is empty.',
  resumeEvidence: [],
};
export const bankTexts = [
  'How would you manage authentication tokens securely in a browser application?',
  'Explain how you would choose caching policies for static resources served from a content delivery network.',
  'How would you model offline synchronization when users edit records without a network connection?',
  'Describe your approach to internationalization and locale-specific formatting across multiple markets.',
  'How would you coordinate a breaking migration across several independently deployed teams?',
];
export function bankQuestions(
  roleId: string,
  difficulty: SessionQuestion['difficulty'],
): SessionQuestion[] {
  return bankTexts.map((text) => ({
    _id: new Types.ObjectId(),
    text,
    idealAnswer:
      'PRIVATE BANK RUBRIC: explain reasoning, alternatives and relevant trade-offs.',
    type: 'technical',
    difficulty,
    roleId,
  }));
}
