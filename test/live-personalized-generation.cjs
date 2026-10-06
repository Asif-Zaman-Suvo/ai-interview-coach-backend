// Run after npm run build. Only synthetic data; prints counts, never prompts or provider bodies.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { Types } = require('mongoose');
const { GroqProvider } = require('../dist/llm/groq.provider');
const { QuestionGenerationService } = require('../dist/sessions/question-generation.service');
const { validateGeneratedQuestions, assertQuestionDiversity } = require('../dist/sessions/question-generation.contract');

async function main() {
  if (!process.env.GROQ_API_KEY?.trim()) {
    console.log('SKIPPED: GROQ_API_KEY unavailable');
    return;
  }
  const roleId = String(new Types.ObjectId());
  const groq = new GroqProvider();
  const service = new QuestionGenerationService({
    async generateStructured(request) {
      try {
        const output = await groq.generateStructured(request);
        let questions;
        try {
          questions = validateGeneratedQuestions(output, 2, request.context.reviewedEvidence);
        } catch (error) {
          console.error(JSON.stringify({ syntheticOutputShape: Array.isArray(output?.questions) ? output.questions.map((q) => ({
            fieldCount: Object.keys(q || {}).length,
            textLength: typeof q.text === 'string' ? q.text.length : null,
            idealAnswerLength: typeof q.idealAnswer === 'string' ? q.idealAnswer.length : null,
            validType: ['technical', 'behavioral'].includes(q.type),
            source: ['resume_personalized', 'target_role'].includes(q.source) ? q.source : 'invalid',
            competencyLength: typeof q.competency === 'string' ? q.competency.length : null,
            rationaleLength: typeof q.rationale === 'string' ? q.rationale.length : null,
            evidenceCount: Array.isArray(q.resumeEvidence) ? q.resumeEvidence.length : null,
            evidenceMatchesReviewed: Array.isArray(q.resumeEvidence) && q.resumeEvidence.every((e) => request.context.reviewedEvidence.includes(e)),
          })) : null }));
          throw error;
        }
        assertQuestionDiversity([...questions, request.context.curatedQuestion]);
        return output;
      } catch (error) {
        const reason = /^(provider_[a-z_]+(?::\d+)?|invalid_generated_questions|invalid_question_diversity)$/.test(error?.message || '') ? error.message : 'LIVE_PROVIDER_CHECK_FAILED';
        console.error(JSON.stringify({ syntheticCheckReason: reason }));
        throw error;
      }
    },
  });
  const result = await service.generate({
    roleId, targetRole: 'Senior Frontend Engineer', difficulty: 'Hard',
    reviewedProfile: {
      suggestedRole: 'Full Stack Engineer', experienceLevel: 'Senior', estimatedYearsOfExperience: 6,
      coreSkills: ['React', 'Angular', 'TypeScript'], additionalSkills: ['NestJS', 'PostgreSQL'],
      workExperience: [{ title: 'Senior Software Engineer', company: null, duration: null }],
      projects: [{ name: null, description: 'Built a large reporting dashboard with reusable UI components and typed client APIs.', technologies: ['React', 'TypeScript'] }],
    },
    privateResumeContext: 'React reporting dashboard: component boundaries, profiling rendering and accessible UI delivery.\nTypeScript API contracts with runtime validation.\nNestJS and PostgreSQL backend integration.',
    bank: [{ _id: new Types.ObjectId(), roleId, difficulty: 'Hard', type: 'technical', text: 'How would you manage authentication tokens securely in a browser application?', idealAnswer: 'Discuss browser threats, token storage, cookies, CSRF, XSS, session expiry, multiple valid approaches and their trade-offs.' }],
  });
  const counts = {};
  for (const question of result.questions) counts[question.source] = (counts[question.source] || 0) + 1;
  console.log(JSON.stringify({ mode: result.mode, count: result.questions.length, sources: counts, privateReferenceAnswersValidated: result.questions.every((q) => !!q.idealAnswer) }));
}
main().catch((error) => {
  console.error(JSON.stringify({ code: error?.response?.code || 'LIVE_CHECK_FAILED', message: 'Synthetic generation check failed; no private content printed.' }));
  process.exitCode = 1;
});
